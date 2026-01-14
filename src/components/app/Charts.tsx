/**
 * Chart primitives, hand-drawn as SVG.
 *
 * No charting library. Three reasons: the whole visual language here is a
 * hairline on a dark ground and every library fights that with its own
 * defaults; the shapes needed are simple; and a dashboard that ships a 200KB
 * dependency to draw eight polylines has got its priorities wrong.
 *
 * Everything is a pure function of numbers in, path out. No client component,
 * no hydration -- these render on the server and arrive as markup.
 */

const money = (c: number) => `€${(c / 100).toFixed(0)}`

/** Map a series into an SVG path across a fixed viewBox. */
function pathOf(vals: number[], w: number, h: number, pad = 2) {
  if (vals.length < 2) return ''
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const span = hi - lo || 1
  return vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w
    const y = h - pad - ((v - lo) / span) * (h - pad * 2)
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

/* ── How you are placed, day by day ─────────────────────────────────────
   Two series on one frame: the share of tracked products where you are at or
   under the cheapest rival, and the median gap between your price and theirs.
   Both are per-product comparisons aggregated afterwards -- comparing a mean
   of your basket to a minimum across a mixed basket is not a metric, it is an
   arithmetic guarantee of bad news. */
export function PriceIndex({ rows }: {
  rows: { day: string; tracked: number; winning: number
          win_pct: number; median_gap: string | number | null }[]
}) {
  if (rows.length < 2) return <p className="empty">Not enough history yet.</p>
  const W = 900, H = 240

  const win = rows.map(r => r.win_pct ?? 0)
  const gap = rows.map(r => Number(r.median_gap ?? 0))

  // Win share is a percentage, so its scale is fixed at 0..100. Pinning it
  // rather than fitting it keeps the same height meaning the same thing on
  // every workspace and every window.
  const yWin = (v: number) => H - 10 - (v / 100) * (H - 20)

  const gLo = Math.min(...gap), gHi = Math.max(...gap)
  const gSpan = (gHi - gLo) || 1
  const yGap = (v: number) => H - 10 - ((v - gLo) / gSpan) * (H - 20)

  const mk = (vals: number[], y: (v: number) => number) => vals.map((v, i) =>
    `${i ? 'L' : 'M'}${((i / (vals.length - 1)) * W).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  const daysWon = rows.filter(r => (r.win_pct ?? 0) > 0).length
  const medGapNow = Number(rows[rows.length - 1].median_gap ?? 0)

  return (
    <figure className="chart-wrap">
      <figcaption className="chart-legend">
        <span><i className="sw-low" />Products you win</span>
        <span><i className="sw-avg" />Median gap to cheapest</span>
        <b>{daysWon} of {rows.length} days with a win &middot; {medGapNow > 0 ? '+' : ''}{medGapNow}% today</b>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart-svg"
           role="img"
           aria-label={`Across ${rows.length} days you were at or under the cheapest rival on at least one product on ${daysWon} of them. Your median gap to the cheapest rival today is ${medGapNow} percent.`}>
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="grid" />
        ))}
        <path d={mk(gap, yGap)} className="ln-avg" vectorEffect="non-scaling-stroke" />
        <path d={mk(win, yWin)} className="ln-low" vectorEffect="non-scaling-stroke" />
        {/* Parity: where your price equals the cheapest rival. */}
        {gLo <= 0 && gHi >= 0 && (
          <line x1="0" x2={W} y1={yGap(0)} y2={yGap(0)} className="ln-you"
                vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      <div className="chart-axis">
        <span>{rows[0].day}</span>
        <span>{rows[rows.length - 1].day}</span>
      </div>
    </figure>
  )
}

/* ── A 60-day sparkline, inline in a table row ──────────────────────────── */
export function Spark({ series, beaten }: { series: number[]; beaten?: boolean }) {
  if (!series || series.length < 2) return <span className="spark-none">—</span>
  const W = 120, H = 26
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`spark${beaten ? ' hot' : ''}`} aria-hidden>
      <path d={pathOf(series, W, H, 3)} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/* ── Where you sit today, as one proportional bar ───────────────────────── */
export function PositionBar({ rows }: {
  rows: { position: string }[]
}) {
  const n = rows.length || 1
  const count = (k: string) => rows.filter(r => r.position === k).length
  const parts = [
    { k: 'cheapest', label: 'Cheapest', n: count('cheapest') },
    { k: 'level', label: 'Level', n: count('level') },
    { k: 'beaten', label: 'Undercut', n: count('beaten') },
  ]
  return (
    <div className="posbar">
      <div className="posbar-track" role="img"
           aria-label={parts.map(p => `${p.n} ${p.label}`).join(', ')}>
        {parts.map(p => p.n > 0 && (
          <span key={p.k} className={`seg seg-${p.k}`} style={{ width: `${(p.n / n) * 100}%` }} />
        ))}
      </div>
      <div className="posbar-key">
        {parts.map(p => (
          <span key={p.k}><i className={`seg-${p.k}`} />{p.label}<b>{p.n}</b></span>
        ))}
      </div>
    </div>
  )
}

/* ── Crawl volume per day ───────────────────────────────────────────────── */
export function Activity({ rows }: {
  rows: { day: string; runs: number; failed: number }[]
}) {
  if (!rows.length) return <p className="empty">No runs in this window.</p>
  const max = Math.max(...rows.map(r => r.runs)) || 1
  return (
    <div className="activity" role="img"
         aria-label={`Crawl runs per day across ${rows.length} days, peaking at ${max}.`}>
      {rows.map(r => (
        <span key={r.day} className={`abar${r.failed ? ' bad' : ''}`}
              style={{ height: `${Math.max(6, (r.runs / max) * 100)}%` }}
              title={`${r.day}: ${r.runs} runs${r.failed ? `, ${r.failed} failed` : ''}`} />
      ))}
    </div>
  )
}
