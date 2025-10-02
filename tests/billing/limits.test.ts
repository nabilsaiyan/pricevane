/**
 * Plan limits are enforced by the database, not by a route handler.
 *
 * The distinction is the whole point: a check in one endpoint is one `if` on
 * one code path. These tests write directly to the table, bypassing every line
 * of application code, and the cap still holds.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Pool } from 'pg'
import { readFileSync } from 'node:fs'

const CONN = process.env.TEST_DATABASE_URL
  ?? 'postgres://postgres:postgres@localhost:55432/pricevane'

let pool: Pool
let orgId: string

beforeAll(async () => {
  pool = new Pool({ connectionString: CONN })
  const sql = (p: string) => readFileSync(p, 'utf8')
  for (const f of ['tests/rls/fixtures/reset.sql', 'tests/rls/fixtures/supabase-shim.sql',
                   'supabase/migrations/0001_multitenant_foundation.sql',
                   'supabase/migrations/0002_rls_policies.sql',
                   'supabase/migrations/0003_usage_limits.sql']) {
    await pool.query(sql(f))
  }
})
afterAll(async () => { await pool?.end() })

beforeEach(async () => {
  await pool.query('delete from organizations')
  const { rows } = await pool.query(
    `insert into organizations (name, slug) values ('Cap Co','cap-${Date.now()}') returning id`)
  orgId = rows[0].id
  // free tier: 25 tracked products
  await pool.query(`insert into subscriptions (organization_id, tier) values ($1,'free')`, [orgId])
})

const addProducts = async (n: number, from = 0) => {
  for (let i = from; i < from + n; i++) {
    await pool.query(
      `insert into products (organization_id, sku, title) values ($1,$2,$3)`,
      [orgId, `SKU-${i}`, `Product ${i}`])
  }
}

describe('the tracked-product cap', () => {
  it('allows a plan up to its limit', async () => {
    await addProducts(25)
    const { rows } = await pool.query(
      'select tracked_products, max_tracked_products from usage_summary where organization_id=$1',
      [orgId])
    expect(rows[0].tracked_products).toBe(25)
    expect(rows[0].max_tracked_products).toBe(25)
  })

  it('refuses the row past the limit, with a distinguishable error code', async () => {
    await addProducts(25)
    await expect(addProducts(1, 25)).rejects.toMatchObject({ code: 'PV001' })
  })

  it('holds even against a direct write that skips every application check', async () => {
    await addProducts(25)
    await expect(
      pool.query(`insert into products (organization_id, sku, title, is_tracked)
                  values ($1,'SNEAKY','Bypassed the API',true)`, [orgId]),
    ).rejects.toMatchObject({ code: 'PV001' })
  })

  it('lets you add untracked products past the cap', async () => {
    await addProducts(25)
    await expect(
      pool.query(`insert into products (organization_id, sku, title, is_tracked)
                  values ($1,'PARKED','Imported but not tracked',false)`, [orgId]),
    ).resolves.toBeTruthy()
  })

  it('an upgrade raises the ceiling immediately', async () => {
    await addProducts(25)
    await pool.query(`update subscriptions set tier='growth' where organization_id=$1`, [orgId])
    await expect(addProducts(1, 25)).resolves.toBeUndefined()
  })

  it('a downgrade never traps an org that is already over the new cap', async () => {
    // Growth to free with 30 tracked. They must still be able to untrack,
    // rename and reprice — otherwise the only way out of a downgrade is support.
    await pool.query(`update subscriptions set tier='growth' where organization_id=$1`, [orgId])
    await addProducts(30)
    await pool.query(`update subscriptions set tier='free' where organization_id=$1`, [orgId])

    await expect(pool.query(
      `update products set title='Renamed' where organization_id=$1 and sku='SKU-0'`, [orgId]))
      .resolves.toBeTruthy()
    await expect(pool.query(
      `update products set is_tracked=false where organization_id=$1 and sku='SKU-1'`, [orgId]))
      .resolves.toBeTruthy()
    // ...but they cannot add another tracked one.
    await expect(addProducts(1, 30)).rejects.toMatchObject({ code: 'PV001' })
  })
})
