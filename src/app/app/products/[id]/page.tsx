import { notFound } from 'next/navigation'
import { getProductHistory } from '@/lib/data/queries'
import { PriceChart, ChartLegend } from '@/components/app/PriceChart'

export const dynamic = 'force-dynamic'

const RIVAL_COLOURS = ['#C6F24E', '#7FB2FF', '#F0A202']

export default async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getProductHistory(id)
  if (!data) notFound()

  const { product, matches, snapshots } = data

  // One series per confirmed rival listing, plus a flat line for our own price
  // so the crossings are readable at a glance.
  const byListing = new Map<string, Array<[number, number]>>()
  for (const s of snapshots) {
    if (s.price_cents == null) continue
    const arr = byListing.get(s.listing_id) ?? []
    arr.push([new Date(s.captured_at).getTime(), s.price_cents])
    byListing.set(s.listing_id, arr)
  }

  const series = matches.map((m, i) => {
    const listing = m.competitor_listings as unknown as
      { id: string; title: string; competitor_stores: { name: string } | null } | null
    return {
      label: listing?.competitor_stores?.name ?? 'Competitor',
      colour: RIVAL_COLOURS[i % RIVAL_COLOURS.length],
      points: byListing.get(m.listing_id) ?? [],
    }
  }).filter(s => s.points.length > 0)

  const span = series.flatMap(s => s.points.map(p => p[0]))
  if (product.our_price_cents != null && span.length) {
    series.unshift({
      label: 'You', colour: '#ECEAE4',
      points: [[Math.min(...span), product.our_price_cents],
               [Math.max(...span), product.our_price_cents]],
    })
  }

  const cheapest = series.filter(s => s.label !== 'You')
    .map(s => s.points.at(-1)?.[1]).filter((v): v is number => v != null)
  const bestRival = cheapest.length ? Math.min(...cheapest) : null
  const under = bestRival != null && product.our_price_cents != null
    && bestRival < product.our_price_cents

  return (
    <>
      <div className="head">
        <div>
          <h1>{product.title}</h1>
          <p>{product.sku}{product.brand ? ` · ${product.brand}` : ''} · six months of history</p>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><span className="lb">Your price</span>
          <div className="v">{product.our_price_cents == null ? '—' : `€${(product.our_price_cents / 100).toFixed(2)}`}</div></div>
        <div className="kpi"><span className="lb">Cheapest rival</span>
          <div className="v" style={{ color: under ? 'var(--alert)' : 'var(--lime)' }}>
            {bestRival == null ? '—' : `€${(bestRival / 100).toFixed(2)}`}
          </div>
          <div className="d">{under ? 'you are being undercut' : 'you are cheapest'}</div>
        </div>
        <div className="kpi"><span className="lb">Matched listings</span>
          <div className="v">{matches.length}</div><div className="d">confirmed</div></div>
        <div className="kpi"><span className="lb">Data points</span>
          <div className="v">{snapshots.length}</div><div className="d">price snapshots</div></div>
      </div>

      <section className="card">
        <header><h2>Price history</h2><ChartLegend series={series} /></header>
        <div style={{ padding: '.9rem 1.05rem 1.2rem' }}>
          <PriceChart series={series} height={300} />
        </div>
      </section>
    </>
  )
}
