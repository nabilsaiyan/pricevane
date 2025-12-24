import { getPool } from '@/lib/db'
import type { PoolClient } from 'pg'

/**
 * Run queries as a signed-in user, with RLS actually enforced.
 *
 * Through Supabase, PostgREST does two things per request: it switches to the
 * `authenticated` role and it sets the verified JWT claims into a GUC, which
 * is where auth.uid() reads the user id from. Locally there is no PostgREST,
 * so this does the same two things by hand -- same role, same GUC, same
 * auth.uid() -- and every policy written for production applies unchanged.
 *
 * This matters more than it looks. The alternative (querying as the owner and
 * filtering by organization_id in the query) would quietly move the tenant
 * boundary out of the database and into application code, which is the exact
 * mistake the whole schema was built to avoid. A missing WHERE clause here
 * still returns nothing.
 *
 * `set local` scopes both settings to the transaction, so a pooled connection
 * cannot leak one request's identity into the next.
 */
export async function withUser<T>(
  userId: string,
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    await client.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: userId, role: 'authenticated' })])
    await client.query('set local role authenticated')
    const out = await fn(client)
    await client.query('commit')
    return out
  } catch (e) {
    await client.query('rollback').catch(() => {})
    throw e
  } finally {
    // Back to the pool as the owner, with no identity attached.
    client.release()
  }
}

/** Convenience: one query as a user, rows out. */
export async function queryAs<T = Record<string, unknown>>(
  userId: string, sql: string, params: unknown[] = [],
): Promise<T[]> {
  return withUser(userId, async c => (await c.query(sql, params)).rows as T[])
}
