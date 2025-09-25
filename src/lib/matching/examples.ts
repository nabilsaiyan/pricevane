import type { Pool } from 'pg'
import type { MatchExample } from './schema'

/**
 * Few-shot examples drawn from this organization's own reviewed matches.
 *
 * Rejections are loaded alongside confirmations, and that is the point. A model
 * shown only successes learns to say yes; the near-misses a reviewer threw out
 * -- the 40cm table that was really the 60cm, the two-seat sofa listed as three
 * -- are what teach it where the line is. So the query takes the most recent of
 * each, interleaved, rather than the most confident of either.
 *
 * Scoped to one organization on purpose: a homeware brand's idea of "the same
 * product" is not a components distributor's, and their reviewers disagree for
 * good reasons.
 */
export async function loadExamples(
  pool: Pool,
  organizationId: string,
  limit = 8,
): Promise<MatchExample[]> {
  const half = Math.max(1, Math.floor(limit / 2))
  const { rows } = await pool.query(
    `(select 'confirmed'::text as verdict, pm.reason,
             p.title  a_title, p.brand  a_brand, p.sku a_sku, p.our_price_cents a_price,
             cl.title b_title, cl.brand b_brand, cl.external_id b_sku, null::int b_price
        from product_matches pm
        join products p             on p.id  = pm.product_id
        join competitor_listings cl on cl.id = pm.listing_id
       where pm.organization_id = $1 and pm.status = 'confirmed'
       order by pm.reviewed_at desc nulls last limit $2)
     union all
     (select 'rejected'::text, pm.reason,
             p.title, p.brand, p.sku, p.our_price_cents,
             cl.title, cl.brand, cl.external_id, null::int
        from product_matches pm
        join products p             on p.id  = pm.product_id
        join competitor_listings cl on cl.id = pm.listing_id
       where pm.organization_id = $1 and pm.status = 'rejected'
       order by pm.reviewed_at desc nulls last limit $2)`,
    [organizationId, half],
  )

  return rows.map(r => ({
    verdict: r.verdict as 'confirmed' | 'rejected',
    reason: r.reason,
    a: { title: r.a_title, brand: r.a_brand, sku: r.a_sku, price_cents: r.a_price },
    b: { title: r.b_title, brand: r.b_brand, sku: r.b_sku, price_cents: r.b_price },
  }))
}
