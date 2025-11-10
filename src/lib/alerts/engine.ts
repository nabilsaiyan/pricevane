/**
 * Alert evaluation.
 *
 * Pure functions over observations, deliberately: the hard part of an alerting
 * system is not delivery, it is deciding when NOT to fire. That decision has to
 * be testable without a database, a clock, or an email provider.
 *
 * The failure mode worth designing against is alert fatigue. A system that
 * emails you every morning because a competitor's price wobbled by 0.4% gets
 * filtered to a folder within a week, and then the one alert that mattered is
 * filtered too. So: thresholds, and a dedupe window.
 */

export type Stock = 'in_stock' | 'out_of_stock' | 'preorder' | 'discontinued' | 'unknown'

export type Observation = {
  listingId: string
  productId: string | null
  storeName: string
  listingTitle: string
  ourPriceCents: number | null
  previous: { priceCents: number | null; stock: Stock } | null
  current: { priceCents: number | null; stock: Stock }
}

export type Rule = {
  id: string
  kind: 'undercut' | 'price_drop' | 'price_rise' | 'back_in_stock' | 'out_of_stock' | 'new_product' | 'discontinued'
  thresholdPct: number | null
  severity: 'info' | 'warning' | 'critical'
  productId?: string | null
  storeName?: string | null
}

export type Candidate = {
  ruleId: string
  kind: Rule['kind']
  severity: Rule['severity']
  listingId: string
  productId: string | null
  title: string
  oldPriceCents: number | null
  newPriceCents: number | null
  /** Stable key for deduplication. Same condition ⇒ same key. */
  dedupeKey: string
}

const pctChange = (from: number, to: number) => ((to - from) / from) * 100

function applies(rule: Rule, o: Observation): boolean {
  if (rule.productId && rule.productId !== o.productId) return false
  if (rule.storeName && rule.storeName !== o.storeName) return false
  return true
}

/**
 * Which rules this observation trips. One observation can trip several — a
 * competitor dropping below you is both a price_drop and an undercut, and a
 * team may well want the first in Slack and the second by email.
 */
export function evaluate(rules: Rule[], o: Observation): Candidate[] {
  const out: Candidate[] = []
  const prev = o.previous
  const cur = o.current

  for (const rule of rules) {
    if (!applies(rule, o)) continue

    const base = {
      ruleId: rule.id, kind: rule.kind, severity: rule.severity,
      listingId: o.listingId, productId: o.productId, title: o.listingTitle,
    }

    switch (rule.kind) {
      case 'undercut': {
        // Only fires on the CROSSING, not on every day they stay cheaper.
        // Without that, being undercut once means being emailed forever.
        if (o.ourPriceCents == null || cur.priceCents == null) break
        const nowUnder = cur.priceCents < o.ourPriceCents
        const wasUnder = prev?.priceCents != null && prev.priceCents < o.ourPriceCents
        if (!nowUnder || wasUnder) break
        const margin = pctChange(o.ourPriceCents, cur.priceCents)
        if (rule.thresholdPct != null && Math.abs(margin) < rule.thresholdPct) break
        out.push({ ...base, oldPriceCents: o.ourPriceCents, newPriceCents: cur.priceCents,
                   dedupeKey: `undercut:${o.listingId}:${cur.priceCents}` })
        break
      }
      case 'price_drop':
      case 'price_rise': {
        if (prev?.priceCents == null || cur.priceCents == null) break
        const change = pctChange(prev.priceCents, cur.priceCents)
        const wanted = rule.kind === 'price_drop' ? change < 0 : change > 0
        if (!wanted) break
        if (rule.thresholdPct != null && Math.abs(change) < rule.thresholdPct) break
        out.push({ ...base, oldPriceCents: prev.priceCents, newPriceCents: cur.priceCents,
                   dedupeKey: `${rule.kind}:${o.listingId}:${prev.priceCents}:${cur.priceCents}` })
        break
      }
      case 'out_of_stock': {
        if (prev?.stock === 'out_of_stock' || cur.stock !== 'out_of_stock') break
        out.push({ ...base, oldPriceCents: null, newPriceCents: null,
                   dedupeKey: `oos:${o.listingId}` })
        break
      }
      case 'back_in_stock': {
        if (prev?.stock !== 'out_of_stock' || cur.stock !== 'in_stock') break
        out.push({ ...base, oldPriceCents: null, newPriceCents: null,
                   dedupeKey: `bis:${o.listingId}` })
        break
      }
      case 'new_product': {
        // No previous observation at all: the crawler has never seen this URL.
        if (prev !== null) break
        out.push({ ...base, oldPriceCents: null, newPriceCents: cur.priceCents,
                   dedupeKey: `new:${o.listingId}` })
        break
      }
      case 'discontinued': {
        if (cur.stock !== 'discontinued' || prev?.stock === 'discontinued') break
        out.push({ ...base, oldPriceCents: prev?.priceCents ?? null, newPriceCents: null,
                   dedupeKey: `gone:${o.listingId}` })
        break
      }
    }
  }
  return out
}

/**
 * Drop candidates already alerted inside the window.
 *
 * A price that oscillates between two values across successive crawls would
 * otherwise generate an alert on every single run — the classic flapping
 * problem. The dedupe key includes the prices, so a genuine new movement still
 * gets through while the same movement re-observed does not.
 */
export function dedupe(
  candidates: Candidate[],
  recentKeys: ReadonlySet<string>,
): Candidate[] {
  const seenThisBatch = new Set<string>()
  return candidates.filter(c => {
    if (recentKeys.has(c.dedupeKey) || seenThisBatch.has(c.dedupeKey)) return false
    seenThisBatch.add(c.dedupeKey)
    return true
  })
}

export function describe(c: Candidate, storeName: string): { title: string; body: string } {
  const money = (v: number | null) => v == null ? '—' : `€${(v / 100).toFixed(2)}`
  const pct = c.oldPriceCents && c.newPriceCents
    ? `${pctChange(c.oldPriceCents, c.newPriceCents) > 0 ? '+' : ''}${pctChange(c.oldPriceCents, c.newPriceCents).toFixed(1)}%`
    : ''
  switch (c.kind) {
    case 'undercut':
      return { title: `${storeName} undercut you on ${c.title}`,
               body: `Now ${money(c.newPriceCents)} against your ${money(c.oldPriceCents)} (${pct}).` }
    case 'price_drop':
      return { title: `${storeName} dropped ${c.title} to ${money(c.newPriceCents)}`,
               body: `Was ${money(c.oldPriceCents)} (${pct}).` }
    case 'price_rise':
      return { title: `${storeName} raised ${c.title} to ${money(c.newPriceCents)}`,
               body: `Was ${money(c.oldPriceCents)} (${pct}).` }
    case 'out_of_stock':
      return { title: `${storeName} is out of stock on ${c.title}`, body: 'Their listing shows no availability.' }
    case 'back_in_stock':
      return { title: `${storeName} restocked ${c.title}`, body: 'Available again.' }
    case 'new_product':
      return { title: `${storeName} listed ${c.title}`, body: `First seen at ${money(c.newPriceCents)}.` }
    case 'discontinued':
      return { title: `${storeName} discontinued ${c.title}`, body: 'The listing has stopped appearing.' }
  }
}
