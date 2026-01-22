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
      // Look the identity up; never create it.
      //
      // This used to upsert into auth.users with `on conflict (email)`, which
      // works against the local shim -- where email is plainly unique -- and
      // fails on a real Supabase project, where auth.users enforces email
      // uniqueness through a partial index that ON CONFLICT cannot infer an
      // arbiter from. It is also the wrong shape regardless: on a real project
      // the identity is created by the auth service, and a row this script
      // invented would have no password, no confirmation and no way to sign in.
      const u = await c.query('select id from auth.users where email = $1', [email])
      if (u.rowCount === 0) {
        console.warn(`  no auth user for ${email} — create it first ` +
                     `(locally: the shim; on Supabase: auth/v1/admin/users)`)
        continue
      }
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
