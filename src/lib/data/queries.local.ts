import { queryAs, withUser } from '@/lib/db/rls'
import type { UsageSummary } from './queries'

/**
 * Local implementations of every tenant query, in SQL.
 *
 * These exist because there is no Supabase project on this machine and the app
 * should still run end to end. They are not a shortcut around the security
 * model: each one runs inside withUser(), which switches to the `authenticated`
 * role and sets the same JWT-claims GUC PostgREST would, so the identical RLS
 * policies decide what comes back.
 *
 * Note what is absent from every statement below: an organization_id filter.
 * That is deliberate and it is the same discipline the Supabase versions
 * follow. The tenant boundary lives in the database. A query that forgets it
 * returns nothing rather than everything, and these were written that way on
 * purpose so the local path cannot drift into being more permissive than
 * production.
 *
 * Nested objects are built with json so the return shapes match PostgREST's
 * embedded-resource output exactly, and the pages need no branching.
 */

export async function getUsageLocal(uid: string): Promise<UsageSummary | null> {
  const rows = await queryAs<UsageSummary>(uid, 'select * from usage_summary limit 1')
  return rows[0] ?? null
}

export async function getOverviewLocal(uid: string) {
  const [alerts, unread, stores, lastRun] = await Promise.all([
    queryAs(uid, `select id, kind, severity, title, created_at,
                         old_price_cents, new_price_cents
                  from alerts order by created_at desc limit 8`),
    queryAs<{ n: number }>(uid, 'select count(*)::int n from alerts where read_at is null'),
    queryAs(uid, 'select id, name, domain, is_active from competitor_stores order by name'),
    queryAs(uid, `select id, status, started_at, finished_at, listings_seen
                  from crawl_runs
                  where started_at >= now() - interval '30 days'
                  order by started_at desc limit 1`),
  ])
  return {
    alerts,
    unreadAlerts: unread[0]?.n ?? 0,
    stores,
    lastRun: lastRun[0] ?? null,
  }
}

export async function getProductsLocal(uid: string, q?: string) {
  const term = q?.trim()
  return queryAs(uid,
    `select id, sku, title, brand, our_price_cents, is_tracked, image_url
     from products
     where ($1::text is null or title ilike '%' || $1 || '%')
     order by title limit 200`,
    [term && term.length ? term : null])
}

export async function getProductHistoryLocal(uid: string, productId: string, days = 182) {
  const product = (await queryAs(uid,
    `select id, sku, title, brand, our_price_cents, image_url
     from products where id = $1`, [productId]))[0]
  if (!product) return null

  const matches = await queryAs(uid,
    `select m.listing_id, m.status, m.confidence,
            json_build_object(
              'id', l.id, 'title', l.title, 'url', l.url, 'store_id', l.store_id,
              'competitor_stores', json_build_object('name', s.name)
            ) as competitor_listings
     from product_matches m
     join competitor_listings l on l.id = m.listing_id
     join competitor_stores  s on s.id = l.store_id
     where m.product_id = $1 and m.status = 'confirmed'`, [productId])

  const ids = matches.map(m => (m as { listing_id: string }).listing_id)
  const snapshots = ids.length
    ? await queryAs(uid,
        `select listing_id, price_cents, stock, captured_at
         from price_snapshots
         where listing_id = any($1::uuid[])
           and captured_at >= now() - ($2 || ' days')::interval
         order by captured_at`, [ids, String(days)])
    : []

  return { product, matches, snapshots }
}

export async function getReviewQueueLocal(uid: string) {
  return queryAs(uid,
    `select m.id, m.confidence, m.reason, m.model, m.status,
            json_build_object('id', p.id, 'sku', p.sku, 'title', p.title,
                              'brand', p.brand, 'our_price_cents', p.our_price_cents,
                              'image_url', p.image_url) as products,
            json_build_object('id', l.id, 'title', l.title, 'url', l.url,
                              'brand', l.brand, 'image_url', l.image_url,
                              'competitor_stores', json_build_object('name', s.name)) as competitor_listings
     from product_matches m
     join products            p on p.id = m.product_id
     join competitor_listings l on l.id = m.listing_id
     join competitor_stores   s on s.id = l.store_id
     where m.status = 'proposed'
     order by m.confidence desc limit 50`)
}

export async function getAlertsLocal(uid: string) {
  return queryAs(uid,
    `select a.id, a.kind, a.severity, a.title, a.body, a.created_at, a.read_at,
            a.old_price_cents, a.new_price_cents,
            case when p.id is null then null else
              json_build_object('id', p.id, 'title', p.title, 'sku', p.sku)
            end as products
     from alerts a
     left join products p on p.id = a.product_id
     order by a.created_at desc limit 100`)
}

export async function getMembershipsLocal(uid: string) {
  return queryAs(uid,
    `select m.organization_id, m.role,
            json_build_object('id', o.id, 'name', o.name, 'slug', o.slug,
                              'is_demo', o.is_demo) as organizations
     from memberships m
     join organizations o on o.id = m.organization_id
     order by m.created_at`)
}

/* ─────────────────────────────────────────────────────────────────────────
   ANALYTICS
   Aggregates for the dashboard. All of them run under withUser(), so RLS
   scopes every row before the aggregate sees it -- an average computed across
   another tenant's prices is not a leak we are willing to have.

   In a Supabase deployment these belong in a view or an RPC rather than
   round-tripping through PostgREST; the shapes below are what that view would
   need to return.
   ───────────────────────────────────────────────────────────────────────── */

/**
 * How you are placed, per day, across the window.
 *
 * The first version of this averaged our prices across every product and
 * compared that to the minimum price across every listing -- a desk lamp
 * against a standing desk. That comparison is meaningless and, worse, it is
 * meaningless in a way that always looks alarming: a minimum over a mixed
 * basket is always below a mean over the same basket, so it reported 0% of
 * days cheapest no matter how the business was actually doing.
 *
 * The comparison has to be per product and then aggregated. For each day and
 * each tracked product with a confirmed match, we compare our price to the
 * cheapest rival for that same product, and report the share of products we
 * won plus the median gap.
 */
export async function getPriceIndexLocal(uid: string, days = 183) {
  return queryAs(uid,
    `with snap as (
       select date_trunc('day', s.captured_at)::date as d,
              m.product_id,
              min(s.price_cents) as best_rival
       from price_snapshots s
       join product_matches m
         on m.listing_id = s.listing_id and m.status = 'confirmed'
       where s.captured_at >= now() - ($1 || ' days')::interval
       group by 1, 2
     ),
     joined as (
       select snap.d, p.our_price_cents as ours, snap.best_rival,
              ((p.our_price_cents - snap.best_rival)::numeric
                / nullif(snap.best_rival, 0)) * 100 as gap
       from snap
       join products p on p.id = snap.product_id
       where p.is_tracked and p.our_price_cents is not null
     )
     select d::text as day,
            count(*)::int as tracked,
            count(*) filter (where ours <= best_rival)::int as winning,
            round((count(*) filter (where ours <= best_rival)::numeric
                   / nullif(count(*), 0)) * 100)::int as win_pct,
            round(percentile_cont(0.5) within group (order by gap)::numeric, 1) as median_gap
     from joined
     group by d order by d`, [String(days)])
}

/** Where you sit today: cheapest, level, or beaten -- per tracked product. */
export async function getPositionLocal(uid: string) {
  return queryAs(uid,
    `with latest as (
       select distinct on (s.listing_id) s.listing_id, s.price_cents
       from price_snapshots s
       order by s.listing_id, s.captured_at desc
     ),
     per_product as (
       select p.id, p.title, p.our_price_cents,
              min(l.price_cents) as best_rival
       from products p
       join product_matches m on m.product_id = p.id and m.status = 'confirmed'
       join latest l on l.listing_id = m.listing_id
       where p.is_tracked and p.our_price_cents is not null
       group by p.id, p.title, p.our_price_cents
     )
     select id, title, our_price_cents, best_rival,
            case when best_rival is null then 'unknown'
                 when our_price_cents < best_rival then 'cheapest'
                 when our_price_cents = best_rival then 'level'
                 else 'beaten' end as position,
            case when best_rival is null or best_rival = 0 then null
                 else round(((our_price_cents - best_rival)::numeric
                              / best_rival) * 100, 1) end as gap_pct
     from per_product order by gap_pct desc nulls last`)
}

/** A 60-day sparkline of the cheapest rival price, per tracked product. */
export async function getSparklinesLocal(uid: string, days = 60) {
  return queryAs(uid,
    `select p.id, p.title, p.our_price_cents,
            array_agg(x.low order by x.d) as series
     from products p
     join lateral (
       select date_trunc('day', s.captured_at)::date as d,
              min(s.price_cents) as low
       from product_matches m
       join price_snapshots s on s.listing_id = m.listing_id
       where m.product_id = p.id and m.status = 'confirmed'
         and s.captured_at >= now() - ($1 || ' days')::interval
       group by 1
     ) x on true
     where p.is_tracked
     group by p.id, p.title, p.our_price_cents
     having count(x.d) > 3
     order by p.title`, [String(days)])
}

/** Crawl volume per day, for the activity strip. */
export async function getCrawlActivityLocal(uid: string, days = 60) {
  return queryAs(uid,
    `select date_trunc('day', started_at)::date::text as day,
            count(*)::int as runs,
            count(*) filter (where status <> 'succeeded')::int as failed
     from crawl_runs
     where started_at >= now() - ($1 || ' days')::interval
     group by 1 order by 1`, [String(days)])
}

/** The largest movers over the window, by percentage. */
export async function getMoversLocal(uid: string, days = 14) {
  return queryAs(uid,
    `with bounds as (
       select s.listing_id,
              min(s.captured_at) as first_at,
              max(s.captured_at) as last_at
       from price_snapshots s
       where s.captured_at >= now() - ($1 || ' days')::interval
       group by s.listing_id
     )
     select l.title, st.name as store,
            f.price_cents as from_cents, t.price_cents as to_cents,
            round(((t.price_cents - f.price_cents)::numeric
                    / nullif(f.price_cents,0)) * 100, 1) as pct
     from bounds b
     join price_snapshots f on f.listing_id = b.listing_id and f.captured_at = b.first_at
     join price_snapshots t on t.listing_id = b.listing_id and t.captured_at = b.last_at
     join competitor_listings l on l.id = b.listing_id
     join competitor_stores   st on st.id = l.store_id
     where f.price_cents is not null and t.price_cents is not null
       and f.price_cents <> t.price_cents
     order by abs(((t.price_cents - f.price_cents)::numeric
                    / nullif(f.price_cents,0))) desc
     limit 8`, [String(days)])
}

/* ── settings ──────────────────────────────────────────────────────────── */

export type OrgSettings = {
  organization_id: string
  match_provider: 'anthropic' | 'openai' | 'google'
  match_model: string
  review_floor: string
  api_key_hint: string | null
  crawl_hour: number
  crawl_frequency: 'nightly' | 'twice_daily' | 'weekly'
}

export async function getSettingsLocal(uid: string): Promise<OrgSettings | null> {
  // api_key_enc is deliberately absent from this projection, and revoked from
  // `authenticated` at the grant layer besides. Two independent reasons the
  // ciphertext cannot reach a page.
  const rows = await queryAs<OrgSettings>(uid,
    `select organization_id, match_provider, match_model, review_floor,
            api_key_hint, crawl_hour, crawl_frequency
     from organization_settings limit 1`)
  return rows[0] ?? null
}

/**
 * Persist settings.
 *
 * No organization_id is passed. The row is reachable only through the SELECT
 * policy, and the UPDATE policy additionally requires app.is_admin -- so a
 * member who is not an admin updates zero rows and is told so, rather than
 * being stopped by a check in the page that someone could forget to write.
 */
export async function saveSettingsLocal(uid: string, p: {
  match_provider: string; match_model: string; review_floor: number
  crawl_hour: number; crawl_frequency: string; apiKey?: string | null
}): Promise<number> {
  return withUser(uid, async c => {
    // Two statements, not one. The obvious single UPDATE preserves an existing
    // key with `api_key_enc = case when $new is null then api_key_enc ... end`
    // -- which READS api_key_enc, the column deliberately not granted to this
    // role, and the whole statement is refused with "permission denied".
    //
    // The fix is to stop reading it rather than to weaken the grant: leave the
    // column untouched when no new key was supplied, and write it blind when
    // one was. A column you can write but never read is exactly what a stored
    // credential should be.
    const r = await c.query(
      `update organization_settings set
         match_provider = $1, match_model = $2, review_floor = $3,
         crawl_hour = $4, crawl_frequency = $5,
         updated_at = now(), updated_by = auth.uid()`,
      [p.match_provider, p.match_model, p.review_floor, p.crawl_hour, p.crawl_frequency])

    if (p.apiKey) {
      await c.query(
        `update organization_settings set
           api_key_enc  = pgp_sym_encrypt($1, $2),
           api_key_hint = '…' || right($1, 4)`,
        [p.apiKey, process.env.PRICEVANE_LOCAL_SECRET ?? 'dev'])
    }
    return r.rowCount ?? 0
  })
}

/** Confirm or reject a proposed match. Returns rows affected. */
export async function decideMatchLocal(
  uid: string, matchId: string, decision: 'confirmed' | 'rejected',
): Promise<number> {
  return withUser(uid, async c => {
    const r = await c.query(
      `update product_matches
          set status = $2::app.match_status,
              reviewed_at = now(), reviewed_by = auth.uid()
        where id = $1 and status = 'proposed'`,
      [matchId, decision])
    return r.rowCount ?? 0
  })
}

/** Mark every unread alert as read. */
export async function markAlertsReadLocal(uid: string): Promise<number> {
  return withUser(uid, async c => {
    const r = await c.query('update alerts set read_at = now() where read_at is null')
    return r.rowCount ?? 0
  })
}
