import { queryAs } from '@/lib/db/rls'
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
