import type { Pool } from 'pg'
import { evaluate, dedupe, describe as render, type Rule, type Observation, type Stock } from './engine'
import { deliver, type Channel } from './delivery'

/**
 * Turn new price snapshots into alerts.
 *
 * Runs after a crawl, on the system connection: this is the platform acting on
 * every tenant's behalf, not a user reading their own data, so it bypasses RLS
 * by design and scopes by organization explicitly instead.
 *
 * The alert row is written first and delivery follows. If Resend is down we
 * still have the alert, and the dashboard still shows it — inverting that
 * (send, then record) loses the alert entirely when a provider has a bad
 * minute, which is precisely the minute you wanted to be told about.
 */
const DEDUPE_WINDOW_HOURS = 24

export type RunSummary = { evaluated: number; created: number; delivered: number; failed: number }

export async function runAlerts(pool: Pool, organizationId: string): Promise<RunSummary> {
  const { rows: ruleRows } = await pool.query(
    `select r.id, r.kind, r.threshold_pct, r.severity, r.product_id,
            cs.name as store_name
       from alert_rules r
       left join competitor_stores cs on cs.id = r.store_id
      where r.organization_id = $1 and r.is_active`,
    [organizationId])

  if (ruleRows.length === 0) return { evaluated: 0, created: 0, delivered: 0, failed: 0 }

  const rules: Rule[] = ruleRows.map(r => ({
    id: r.id, kind: r.kind, thresholdPct: r.threshold_pct == null ? null : Number(r.threshold_pct),
    severity: r.severity, productId: r.product_id, storeName: r.store_name,
  }))

  // The two most recent snapshots per listing. DISTINCT ON is the cheapest way
  // to say "latest per group" in Postgres, and the window function gives us the
  // one before it in the same pass rather than a second round trip per listing.
  const { rows: obsRows } = await pool.query(
    `with ranked as (
       select ps.listing_id, ps.price_cents, ps.stock, ps.captured_at,
              row_number() over (partition by ps.listing_id order by ps.captured_at desc) as rn
         from price_snapshots ps
        where ps.organization_id = $1
          and ps.captured_at > now() - interval '7 days'
     )
     select cl.id as listing_id, cl.title as listing_title,
            cs.name as store_name,
            pm.product_id, p.our_price_cents,
            cur.price_cents as cur_price, cur.stock as cur_stock,
            prev.price_cents as prev_price, prev.stock as prev_stock,
            prev.listing_id is not null as has_previous
       from ranked cur
       join competitor_listings cl on cl.id = cur.listing_id
       join competitor_stores cs   on cs.id = cl.store_id
       left join ranked prev on prev.listing_id = cur.listing_id and prev.rn = 2
       left join product_matches pm on pm.listing_id = cl.id and pm.status = 'confirmed'
       left join products p on p.id = pm.product_id
      where cur.rn = 1`,
    [organizationId])

  const observations: Observation[] = obsRows.map(r => ({
    listingId: r.listing_id,
    productId: r.product_id,
    storeName: r.store_name,
    listingTitle: r.listing_title,
    ourPriceCents: r.our_price_cents,
    previous: r.has_previous
      ? { priceCents: r.prev_price, stock: r.prev_stock as Stock }
      : null,
    current: { priceCents: r.cur_price, stock: r.cur_stock as Stock },
  }))

  const candidates = observations.flatMap(o => evaluate(rules, o))

  // Recent keys are reconstructed from what we already sent, so a restart or a
  // second run in the same window does not re-alert.
  const { rows: recent } = await pool.query(
    `select dedupe_key from alerts
      where organization_id = $1 and created_at > now() - ($2 || ' hours')::interval`,
    [organizationId, DEDUPE_WINDOW_HOURS])
  const fresh = dedupe(candidates, new Set(recent.map(r => r.dedupe_key)))

  const { rows: channelRows } = await pool.query(
    `select kind, target, secret from notification_channels
      where organization_id = $1 and is_active`,
    [organizationId])
  const channels: Channel[] = channelRows.map(c => ({ kind: c.kind, target: c.target, secret: c.secret }))

  let created = 0, delivered = 0, failed = 0

  for (const c of fresh) {
    const store = observations.find(o => o.listingId === c.listingId)?.storeName ?? 'A competitor'
    const { title, body } = render(c, store)

    // on conflict do nothing: the dedupe key is also a unique index, so two runs
    // racing each other cannot both insert the same alert.
    //
    // The `where dedupe_key is not null` is required, not decorative. The index
    // is partial — historic rows carry no key and must not collide — and
    // Postgres only matches a partial index if ON CONFLICT repeats its
    // predicate. Without it the statement fails with "no unique or exclusion
    // constraint matching the ON CONFLICT specification", which reads like a
    // missing index rather than a missing WHERE.
    const { rows } = await pool.query(
      `insert into alerts (organization_id, rule_id, product_id, listing_id, kind, severity,
         title, body, old_price_cents, new_price_cents, dedupe_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (organization_id, dedupe_key) where dedupe_key is not null do nothing
       returning id`,
      [organizationId, c.ruleId, c.productId, c.listingId, c.kind, c.severity,
       title, body, c.oldPriceCents, c.newPriceCents, c.dedupeKey])

    if (rows.length === 0) continue      // another run got there first
    created++

    if (channels.length === 0) continue
    const results = await deliver(c, store, channels)
    const ok = results.filter(r => r.ok).length
    delivered += ok
    failed += results.length - ok
    if (ok > 0) {
      await pool.query('update alerts set delivered_at = now() where id = $1', [rows[0].id])
    }
  }

  return { evaluated: observations.length, created, delivered, failed }
}
