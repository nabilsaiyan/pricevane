import { Pool } from 'pg'

/**
 * Direct Postgres pool for system-level work: the Stripe webhook and the
 * crawler ingest. Both need real transactions, which PostgREST cannot give us.
 *
 * This connection bypasses RLS. That is deliberate and it is why it must never
 * be reachable from a request that carries a user's identity -- every route
 * that serves a tenant goes through the Supabase client instead, so the
 * database, not the route handler, decides what that tenant may see.
 */
declare global { var __pvPool: Pool | undefined }

export function getPool(): Pool {
  if (!globalThis.__pvPool) {
    globalThis.__pvPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
    })
  }
  return globalThis.__pvPool
}
