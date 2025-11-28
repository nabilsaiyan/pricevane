/**
 * Evaluate alert rules for every organization and deliver what fires.
 *
 * Runs after a crawl. Each organization is processed independently so one
 * tenant's broken Slack webhook cannot stop another tenant's email.
 */
import { Pool } from 'pg'
import { config } from 'dotenv'
import { runAlerts } from '../src/lib/alerts/run'

config({ path: '.env.local' })
config({ path: '.env' })

const CONN = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL
if (!CONN) { console.error('set DATABASE_URL'); process.exit(1) }

async function main() {
  const pool = new Pool({ connectionString: CONN })
  const { rows } = await pool.query('select id, name from organizations')

  for (const org of rows) {
    try {
      const s = await runAlerts(pool, org.id)
      console.log(`${org.name.padEnd(20)} ${s.evaluated} observed · ${s.created} created · ` +
                  `${s.delivered} delivered · ${s.failed} failed`)
    } catch (err) {
      // One tenant failing is not a reason to skip the rest.
      console.error(`${org.name}: ${err instanceof Error ? err.message : err}`)
    }
  }
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
