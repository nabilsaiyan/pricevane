type Series = { label: string; colour: string; dashed?: boolean; points: Array<[number, number]> }

/**
 * A price history chart as plain server-rendered SVG.
 *
 * No charting library: this draws two or three monotonic series over time and
 * nothing else, and Recharts would ship ~90KB of client JavaScript plus its own
 * visual opinions to do it. Server-rendered means it is in the HTML, works with
 * JS disabled, and never shifts layout on hydration.
 */
export function PriceChart({ series, height = 260, currency = '€' }: {
  series: Series[]; height?: number; currency?: string
}) {
  const all = series.flatMap(s => s.points)
  if (all.length === 0) return <div className="empty">No price history yet.</div>

  const xs = all.map(p => p[0]), ys = all.map(p => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  // Pad the value axis by 8% so lines never graze the frame, and never let a
  // flat series collapse to a zero-height band.
  const lo = Math.min(...ys), hi = Math.max(...ys)
  const pad = Math.max((hi - lo) * 0.08, Math.max(hi * 0.02, 1))
  const y0 = lo - pad, y1 = hi + pad

  const W = 1000, H = height, L = 52, R = 12, T = 12, B = 24
  const px = (x: number) => L + ((x - x0) / Math.max(x1 - x0, 1)) * (W - L - R)
  const py = (y: number) => T + (1 - (y - y0) / Math.max(y1 - y0, 1)) * (H - T - B)

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => y0 + f * (y1 - y0))
  const money = (c: number) => `${currency}${(c / 100).toFixed(0)}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} role="img"
         preserveAspectRatio="none"
         aria-label={`Price history. ${series.map(s => s.label).join(' versus ')}.`}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} y1={py(t)} x2={W - R} y2={py(t)} stroke="rgba(236,234,228,.07)" />
          <text x={L - 8} y={py(t) + 3.5} textAnchor="end"
                fill="#4E5559" fontSize="10" fontFamily="var(--fm)">{money(t)}</text>
        </g>
      ))}
      {series.map((s, i) => (
        <path key={i} fill="none" stroke={s.colour} strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              strokeDasharray={s.dashed ? '4 4' : undefined}
              d={s.points.map((p, j) => `${j ? 'L' : 'M'}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ')} />
      ))}
    </svg>
  )
}

export function ChartLegend({ series }: { series: Array<{ label: string; colour: string }> }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      {series.map(s => (
        <span key={s.label} style={{
          display: 'inline-flex', alignItems: 'center', gap: '.4rem',
          fontFamily: 'var(--fm)', fontSize: 10.5, letterSpacing: '.1em',
          textTransform: 'uppercase', color: 'var(--t2)',
        }}>
          <i style={{ width: 12, height: 2, background: s.colour, display: 'block' }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}
