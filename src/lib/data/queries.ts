import { getSupabaseServer } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getLocalUserId, isLocalAuth } from '@/lib/auth/local'
import * as L from './queries.local'

/**
 * Every query here omits organization_id. That is not an oversight — RLS
 * supplies the tenant boundary, so a query that forgets it returns nothing
 * rather than everything. Passing it as well would be belt-and-braces that
 * hides which layer is actually doing the work.
 *
 * Each also returns empty when Supabase is unconfigured. Next evaluates a page
 * component even when its layout short-circuits, so without this a fresh clone
 * throws from inside a query before the layout's setup screen can render — and
 * the developer sees a stack trace instead of instructions. "No database" and
 * "no rows" are the same answer to the caller.
 */

/** The local user id, when running without a Supabase project. */
async function localUid(): Promise<string | null> {
  return isLocalAuth() ? getLocalUserId() : null
}

export type UsageSummary = {
  organization_id: string; tier: string; status: string
  max_tracked_products: number; max_competitor_stores: number; checks_per_day: number
  tracked_products: number; active_stores: number
}

export async function getUsage(): Promise<UsageSummary | null> {
  const uid = await localUid()
  if (uid) return L.getUsageLocal(uid)
  if (!isSupabaseConfigured()) return null
  const s = await getSupabaseServer()
  const { data } = await s.from('usage_summary').select('*').maybeSingle()
  return data as UsageSummary | null
}

export async function getOverview() {
  const uid = await localUid()
  if (uid) return L.getOverviewLocal(uid)
  if (!isSupabaseConfigured()) return { alerts: [], unreadAlerts: 0, stores: [], lastRun: null }
  const s = await getSupabaseServer()
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const [alerts, unread, stores, lastRun] = await Promise.all([
    s.from('alerts').select('id, kind, severity, title, created_at, old_price_cents, new_price_cents')
      .order('created_at', { ascending: false }).limit(8),
    s.from('alerts').select('id', { count: 'exact', head: true }).is('read_at', null),
    s.from('competitor_stores').select('id, name, domain, is_active'),
    s.from('crawl_runs').select('id, status, started_at, finished_at, listings_seen')
      .gte('started_at', since).order('started_at', { ascending: false }).limit(1),
  ])

  return {
    alerts: alerts.data ?? [],
    unreadAlerts: unread.count ?? 0,
    stores: stores.data ?? [],
    lastRun: lastRun.data?.[0] ?? null,
  }
}

export async function getProducts(q?: string) {
  const uid = await localUid()
  if (uid) return L.getProductsLocal(uid, q)
  if (!isSupabaseConfigured()) return []
  const s = await getSupabaseServer()
  let query = s.from('products')
    .select('id, sku, title, brand, our_price_cents, is_tracked, image_url')
    .order('title')
  if (q?.trim()) query = query.ilike('title', `%${q.trim()}%`)
  const { data } = await query.limit(200)
  return data ?? []
}

/** One product, its confirmed rivals, and every snapshot for the window. */
export async function getProductHistory(productId: string, days = 182) {
  const uid = await localUid()
  if (uid) return L.getProductHistoryLocal(uid, productId, days)
  if (!isSupabaseConfigured()) return null
  const s = await getSupabaseServer()
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const { data: product } = await s.from('products')
    .select('id, sku, title, brand, our_price_cents, image_url')
    .eq('id', productId).maybeSingle()
  if (!product) return null

  const { data: matches } = await s.from('product_matches')
    .select('listing_id, status, confidence, competitor_listings(id, title, url, store_id, competitor_stores(name))')
    .eq('product_id', productId).eq('status', 'confirmed')

  const listingIds = (matches ?? []).map(m => m.listing_id)
  const { data: snaps } = listingIds.length
    ? await s.from('price_snapshots')
        .select('listing_id, price_cents, stock, captured_at')
        .in('listing_id', listingIds).gte('captured_at', since)
        .order('captured_at')
    : { data: [] }

  return { product, matches: matches ?? [], snapshots: snaps ?? [] }
}

export async function getReviewQueue() {
  const uid = await localUid()
  if (uid) return L.getReviewQueueLocal(uid)
  if (!isSupabaseConfigured()) return []
  const s = await getSupabaseServer()
  const { data } = await s.from('product_matches')
    .select(`id, confidence, reason, model, status,
             products(id, sku, title, brand, our_price_cents, image_url),
             competitor_listings(id, title, url, brand, image_url, competitor_stores(name))`)
    .eq('status', 'proposed')
    .order('confidence', { ascending: false })
    .limit(50)
  return data ?? []
}

export async function getAlerts() {
  const uid = await localUid()
  if (uid) return L.getAlertsLocal(uid)
  if (!isSupabaseConfigured()) return []
  const s = await getSupabaseServer()
  const { data } = await s.from('alerts')
    .select(`id, kind, severity, title, body, created_at, read_at,
             old_price_cents, new_price_cents, products(id, title, sku)`)
    .order('created_at', { ascending: false }).limit(100)
  return data ?? []
}

/* ── analytics ──────────────────────────────────────────────────────────
   Local-only for now. These are multi-CTE aggregates; through Supabase they
   belong in a view or an RPC rather than being reassembled client-side from
   PostgREST calls, so the Supabase branch returns empty rather than pretending
   with a slower, wronger version. */
export async function getPriceIndex() {
  const uid = await localUid()
  return uid ? L.getPriceIndexLocal(uid) : []
}
export async function getPosition() {
  const uid = await localUid()
  return uid ? L.getPositionLocal(uid) : []
}
export async function getSparklines() {
  const uid = await localUid()
  return uid ? L.getSparklinesLocal(uid) : []
}
export async function getCrawlActivity() {
  const uid = await localUid()
  return uid ? L.getCrawlActivityLocal(uid) : []
}
export async function getMovers() {
  const uid = await localUid()
  return uid ? L.getMoversLocal(uid) : []
}

/* ── settings and actions ───────────────────────────────────────────────── */
export async function getSettings() {
  const uid = await localUid()
  return uid ? L.getSettingsLocal(uid) : null
}
export async function saveSettings(p: Parameters<typeof L.saveSettingsLocal>[1]) {
  const uid = await localUid()
  if (!uid) return 0
  return L.saveSettingsLocal(uid, p)
}
export async function decideMatch(id: string, decision: 'confirmed' | 'rejected') {
  const uid = await localUid()
  if (!uid) return 0
  return L.decideMatchLocal(uid, id, decision)
}
export async function markAlertsRead() {
  const uid = await localUid()
  if (!uid) return 0
  return L.markAlertsReadLocal(uid)
}
