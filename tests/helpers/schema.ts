import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Build the database the tests run against.
 *
 * Migrations are read from the directory rather than listed here on purpose. A
 * hardcoded list silently stops covering the newest migration the moment
 * someone adds one, and the suite keeps passing against a schema that is no
 * longer the schema — which is how a policy ships untested.
 */
export function schemaSql(): string[] {
  const migrations = readdirSync('supabase/migrations')
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => readFileSync(join('supabase/migrations', f), 'utf8'))

  return [
    readFileSync('tests/rls/fixtures/reset.sql', 'utf8'),
    readFileSync('tests/rls/fixtures/supabase-shim.sql', 'utf8'),
    ...migrations,
  ]
}
