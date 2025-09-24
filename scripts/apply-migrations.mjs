// Applies the shim + migrations to a throwaway Postgres, for local work and CI.
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
const conn = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:55432/pricevane'
const c = new Client({ connectionString: conn }); await c.connect()
for (const f of ['tests/rls/fixtures/reset.sql','tests/rls/fixtures/supabase-shim.sql',
                 'supabase/migrations/0001_multitenant_foundation.sql',
                 'supabase/migrations/0002_rls_policies.sql',
                 'supabase/migrations/0003_usage_limits.sql']) {
  await c.query(readFileSync(f,'utf8')); console.log('applied', f)
}
await c.end()
