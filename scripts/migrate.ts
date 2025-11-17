/**
 * Migration runner.
 *
 * Applies supabase/migrations/*.sql in filename order against DATABASE_URL and
 * records what it applied, so re-running is a no-op rather than an error.
 *
 * Deliberately not the Supabase CLI. The CLI is a Homebrew install and a linked
 * project before anyone can see the schema; this needs only the connection
 * string that is already in .env.local. The CLI still works for anyone who has
 * it — this writes to the same database and skips files it has already run.
 *
 * Each file runs inside its own transaction. A migration that fails half way
 * leaves nothing behind, so the next attempt starts from a known state instead
 * of a schema that is neither the old one nor the new one.
 */
import { Client } from 'pg'
import { readdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const CONN = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL
if (!CONN) {
  console.error('Set DATABASE_URL in .env.local (Supabase > Settings > Database),')
  console.error('or TEST_DATABASE_URL to point at the throwaway Docker Postgres.')
  process.exit(1)
}

const DIR = 'supabase/migrations'

async function main() {
  const client = new Client({ connectionString: CONN })
  await client.connect()

  await client.query(`
    create table if not exists public.schema_migrations (
      filename   text primary key,
      -- The checksum catches a migration edited after it was applied, which is
      -- the quiet way two environments drift apart.
      checksum   text not null,
      applied_at timestamptz not null default now()
    )`)

  const { rows } = await client.query<{ filename: string; checksum: string }>(
    'select filename, checksum from schema_migrations')
  const applied = new Map(rows.map(r => [r.filename, r.checksum]))

  const files = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()
  let ran = 0

  for (const file of files) {
    const sql = readFileSync(join(DIR, file), 'utf8')
    const checksum = createHash('sha256').update(sql).digest('hex').slice(0, 16)
    const seen = applied.get(file)

    if (seen === checksum) { console.log(`  skip   ${file}`); continue }
    if (seen && seen !== checksum) {
      console.error(`\n  ${file} has changed since it was applied.`)
      console.error('  Migrations are append-only: add a new file rather than editing this one.')
      process.exit(1)
    }

    process.stdout.write(`  apply  ${file} … `)
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query(
        'insert into schema_migrations (filename, checksum) values ($1,$2)', [file, checksum])
      await client.query('commit')
      console.log('ok')
      ran++
    } catch (err) {
      await client.query('rollback')
      console.log('failed')
      console.error(`\n${err instanceof Error ? err.message : err}\n`)
      process.exit(1)
    }
  }

  await client.end()
  console.log(ran ? `\n${ran} migration(s) applied.` : '\nAlready up to date.')
}

main().catch(e => { console.error(e); process.exit(1) })
