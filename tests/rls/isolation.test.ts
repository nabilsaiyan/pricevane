/**
 * Tenant isolation, proved rather than asserted.
 *
 * The claim under test: a user in organization A cannot read organization B's
 * rows *even with a crafted query* -- one that names B's id directly, that
 * drops the tenant filter entirely, or that reaches B's rows through a join
 * from a table the user does legitimately own.
 *
 * The test therefore does not go through the application. It opens a raw
 * Postgres connection, becomes the `authenticated` role, sets the same JWT
 * claims GUC that PostgREST sets from a verified token, and then attacks the
 * database directly. Anything that leaks here leaks in production.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CONN = process.env.TEST_DATABASE_URL
  ?? 'postgres://postgres:postgres@localhost:55432/pricevane'

let root: Client          // superuser: migrates and seeds, bypasses RLS
let client: Client        // the attacker's connection

const ids = {
  orgA: '', orgB: '',
  userA: '', userB: '',
  productA: '', productB: '',
  storeB: '', listingB: '',
}

/** Run `fn` as `authenticated` carrying `userId`'s JWT, then roll back. */
async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await client.query('begin')
  await client.query(`select set_config('request.jwt.claims', $1, true)`,
    [JSON.stringify({ sub: userId, role: 'authenticated' })])
  await client.query('set local role authenticated')
  try {
    return await fn()
  } finally {
    await client.query('rollback')
  }
}

beforeAll(async () => {
  root = new Client({ connectionString: CONN })
  await root.connect()

  const sql = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
  await root.query(sql('tests/rls/fixtures/reset.sql'))
  await root.query(sql('tests/rls/fixtures/supabase-shim.sql'))
  await root.query(sql('supabase/migrations/0001_multitenant_foundation.sql'))
  await root.query(sql('supabase/migrations/0002_rls_policies.sql'))
  await root.query(sql('supabase/migrations/0003_usage_limits.sql'))

  const one = async (q: string, v: unknown[] = []) => (await root.query(q, v)).rows[0]

  const ua = await one(`insert into auth.users (email) values ('a@example.test') returning id`)
  const ub = await one(`insert into auth.users (email) values ('b@example.test') returning id`)
  ids.userA = ua.id; ids.userB = ub.id

  const oa = await one(`insert into organizations (name, slug) values ('Alpha Retail','alpha') returning id`)
  const ob = await one(`insert into organizations (name, slug) values ('Bravo Goods','bravo') returning id`)
  ids.orgA = oa.id; ids.orgB = ob.id

  await root.query(`insert into memberships (organization_id, user_id, role) values ($1,$2,'owner'),($3,$4,'owner')`,
    [ids.orgA, ids.userA, ids.orgB, ids.userB])
  await root.query(`insert into subscriptions (organization_id, tier) values ($1,'growth'),($2,'scale')`,
    [ids.orgA, ids.orgB])

  const pa = await one(`insert into products (organization_id, sku, title, our_price_cents)
                        values ($1,'A-1','Alpha Task Chair',8900) returning id`, [ids.orgA])
  const pb = await one(`insert into products (organization_id, sku, title, our_price_cents)
                        values ($1,'B-1','Bravo Secret Product',12345) returning id`, [ids.orgB])
  ids.productA = pa.id; ids.productB = pb.id

  const sb = await one(`insert into competitor_stores (organization_id, name, base_url, domain)
                        values ($1,'Bravo Rival','https://rival.test','rival.test') returning id`, [ids.orgB])
  ids.storeB = sb.id
  const lb = await one(`insert into competitor_listings (organization_id, store_id, url, title)
                        values ($1,$2,'https://rival.test/p/1','Bravo Rival Listing') returning id`,
                       [ids.orgB, ids.storeB])
  ids.listingB = lb.id
  await root.query(`insert into price_snapshots (organization_id, listing_id, price_cents)
                    values ($1,$2,9999)`, [ids.orgB, ids.listingB])
  await root.query(`insert into alerts (organization_id, kind, title)
                    values ($1,'undercut','Bravo confidential alert')`, [ids.orgB])

  client = new Client({ connectionString: CONN })
  await client.connect()
})

afterAll(async () => {
  await client?.end()
  await root?.end()
})

describe('a member of organization A', () => {
  it('sees only its own organization', async () => {
    await asUser(ids.userA, async () => {
      const { rows } = await client.query('select id, name from organizations')
      expect(rows).toHaveLength(1)
      expect(rows[0].id).toBe(ids.orgA)
    })
  })

  it('gets nothing when it names organization B explicitly', async () => {
    await asUser(ids.userA, async () => {
      // The crafted query: the tenant filter is present and correct, and points
      // at someone else. Application-layer filtering would happily serve this.
      const { rows } = await client.query(
        'select * from products where organization_id = $1', [ids.orgB])
      expect(rows).toHaveLength(0)
    })
  })

  it('gets nothing when the tenant filter is omitted entirely', async () => {
    await asUser(ids.userA, async () => {
      const { rows } = await client.query('select organization_id, title from products')
      expect(rows).toHaveLength(1)
      expect(rows[0].organization_id).toBe(ids.orgA)
      expect(rows.map(r => r.title)).not.toContain('Bravo Secret Product')
    })
  })

  it('cannot reach B by primary key', async () => {
    await asUser(ids.userA, async () => {
      const { rows } = await client.query('select * from products where id = $1', [ids.productB])
      expect(rows).toHaveLength(0)
    })
  })

  it('cannot reach B through a join it is otherwise entitled to make', async () => {
    await asUser(ids.userA, async () => {
      const { rows } = await client.query(`
        select ps.price_cents
          from price_snapshots ps
          join competitor_listings cl on cl.id = ps.listing_id
         where cl.url like '%rival.test%'`)
      expect(rows).toHaveLength(0)
    })
  })

  it('cannot aggregate across the boundary', async () => {
    await asUser(ids.userA, async () => {
      // COUNT is the classic leak: it returns no rows, only a number, so a
      // naive policy that filters the result set but not the scan still leaks
      // cardinality. It must count 1, not 2.
      const { rows } = await client.query('select count(*)::int as n from products')
      expect(rows[0].n).toBe(1)
    })
  })

  it('cannot read B via a correlated subquery or EXISTS probe', async () => {
    await asUser(ids.userA, async () => {
      const { rows } = await client.query(
        `select exists(select 1 from alerts where organization_id = $1) as leaked`, [ids.orgB])
      expect(rows[0].leaked).toBe(false)
    })
  })

  it('cannot see B\'s subscription tier', async () => {
    await asUser(ids.userA, async () => {
      const { rows } = await client.query('select organization_id, tier from subscriptions')
      expect(rows).toHaveLength(1)
      expect(rows[0].organization_id).toBe(ids.orgA)
    })
  })

  it('cannot see B\'s members', async () => {
    await asUser(ids.userA, async () => {
      const { rows } = await client.query('select user_id from memberships')
      expect(rows).toHaveLength(1)
      expect(rows[0].user_id).toBe(ids.userA)
    })
  })
})

describe('writes across the boundary', () => {
  it('cannot INSERT a row into organization B', async () => {
    await asUser(ids.userA, async () => {
      await expect(client.query(
        `insert into products (organization_id, sku, title) values ($1,'X','Planted')`,
        [ids.orgB])).rejects.toThrow(/row-level security/i)
    })
  })

  it('cannot move its own row into organization B', async () => {
    await asUser(ids.userA, async () => {
      // This is the attack a USING-only policy misses: the row is visible and
      // updatable, and the update relocates it across the tenant boundary.
      // WITH CHECK is what rejects it.
      await expect(client.query(
        `update products set organization_id = $1 where id = $2`,
        [ids.orgB, ids.productA])).rejects.toThrow(/row-level security/i)
    })
  })

  it('cannot DELETE organization B\'s rows', async () => {
    await asUser(ids.userA, async () => {
      const { rowCount } = await client.query('delete from products where id = $1', [ids.productB])
      expect(rowCount).toBe(0)
    })
  })

  it('cannot grant itself membership of organization B', async () => {
    await asUser(ids.userA, async () => {
      await expect(client.query(
        `insert into memberships (organization_id, user_id, role) values ($1,$2,'owner')`,
        [ids.orgB, ids.userA])).rejects.toThrow(/row-level security/i)
    })
  })

  it('cannot rewrite the audit log', async () => {
    await asUser(ids.userA, async () => {
      // Defence in depth: this is refused by the GRANT before RLS is even
      // consulted -- authenticated holds select+insert on audit_log and
      // nothing more. The absent UPDATE policy is the second line, not the
      // first. An append-only trail is enforced twice over.
      await expect(client.query(
        `update audit_log set action = 'tampered' where organization_id = $1`, [ids.orgA]))
        .rejects.toThrow(/permission denied/i)
    })
  })
})

describe('billing tables are not client-writable', () => {
  it('a member cannot upgrade their own tier', async () => {
    await asUser(ids.userA, async () => {
      // Subscriptions are read-only to every client role: tier is whatever
      // Stripe last told the webhook it was. Changing your own plan is not a
      // policy decision here, it is an unGRANTed verb.
      await expect(client.query(
        `update subscriptions set tier = 'scale' where organization_id = $1`, [ids.orgA]))
        .rejects.toThrow(/permission denied/i)
    })
  })

  it('the Stripe event ledger is invisible to clients', async () => {
    await asUser(ids.userA, async () => {
      await expect(client.query('select * from stripe_events'))
        .rejects.toThrow(/permission denied/i)
    })
  })
})

describe('an anonymous caller', () => {
  it('sees no tenant data at all', async () => {
    await client.query('begin')
    await client.query('set local role anon')
    const { rows } = await client.query('select * from plan_limits')
    expect(rows.length).toBeGreaterThan(0)          // pricing is public
    await expect(client.query('select * from products'))
      .rejects.toThrow(/permission denied/i)        // everything else is not
    await client.query('rollback')
  })
})
