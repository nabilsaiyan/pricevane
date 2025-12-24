/**
 * Create local development identities and attach them to the seeded orgs.
 *
 * Supabase would normally own auth.users and the demo join would happen through
 * the join_demo() RPC after a real sign-in. With no Supabase project, this does
 * the equivalent directly: two users, each an owner of one seeded organisation
 * and a member of nothing else.
 *
 * That "member of nothing else" is the whole point -- it is what makes the
 * isolation demo real rather than decorative. Sign in as one and the other
 * tenant's rows are not merely hidden by a filter, they do not come back.
 */
import { Pool } from 'pg'

const CONN = process.env.DATABASE_URL
if (!CONN) { console.error('Set DATABASE_URL'); process.exit(1) }

const USERS = [
  { email: 'marta@northlight.test', slug: 'northlight' },
  { email: 'joris@atelier-ferro.test', slug: 'atelier-ferro' },
]

async function main() {
  const pool = new Pool({ connectionString: CONN })
  const c = await pool.connect()
  try {
    await c.query('begin')
    for (const { email, slug } of USERS) {
      const u = await c.query(
        `insert into auth.users (email) values ($1)
         on conflict (email) do update set email = excluded.email
         returning id`, [email])
      const userId = u.rows[0].id as string

      const org = await c.query('select id, name from organizations where slug = $1', [slug])
      if (org.rowCount === 0) { console.warn(`  no org ${slug} — run the seed first`); continue }

      await c.query(
        `insert into memberships (organization_id, user_id, role)
         values ($1, $2, 'owner')
         on conflict (organization_id, user_id) do update set role = 'owner'`,
        [org.rows[0].id, userId])
      console.log(`  ${email.padEnd(28)} owner of ${org.rows[0].name}`)
    }
    await c.query('commit')
  } catch (e) { await c.query('rollback'); throw e }
  finally { c.release(); await pool.end() }
}

main().then(() => console.log('\ndev identities ready.'))
  .catch(e => { console.error(e); process.exit(1) })
