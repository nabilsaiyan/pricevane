import { getPool } from '@/lib/db'

/**
 * The development sign-in.
 *
 * Two seeded identities, each owning exactly one organisation and belonging to
 * nothing else. Switching between them is the isolation demo: the numbers do
 * not merely filter, the other tenant's rows stop existing.
 */
export async function LocalSignIn() {
  const { rows } = await getPool().query<{ id: string; email: string; org: string }>(
    `select u.id, u.email, coalesce(o.name, '—') as org
     from auth.users u
     left join memberships m on m.user_id = u.id
     left join organizations o on o.id = m.organization_id
     order by u.email`)

  return (
    <div className="signin">
      <span className="eyebrow">Development sign-in</span>
      <h1 className="h2">Choose an identity.</h1>
      <p className="lede">
        No Supabase project is configured, so the app is running against local
        Postgres with the same auth shim the isolation tests use. Each identity
        owns one workspace and belongs to no other — the boundary is the
        database, not this screen.
      </p>
      <div className="idlist">
        {rows.map(u => (
          <form key={u.id} action="/api/local-session" method="post">
            <input type="hidden" name="email" value={u.email} />
            <button type="submit" className="idcard">
              <i>{u.email.slice(0, 2).toUpperCase()}</i>
              <span><b>{u.email}</b>{u.org}</span>
              <em>Continue &rarr;</em>
            </button>
          </form>
        ))}
      </div>
    </div>
  )
}
