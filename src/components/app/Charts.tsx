'use client'

import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line,
  LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

/**
 * Dashboard charts, on Recharts.
 *
 * These were hand-drawn SVG paths. That was the wrong call: it meant no
 * tooltips, no axes, no responsive re-measure, and every future chart starting
 * from arithmetic. A charting library is the right dependency for a dashboard
 * whose whole subject is a number moving over time.
 *
 * Client components, because Recharts measures the DOM to size itself. The
 * queries that feed them still run on the server, so only the drawing crosses
 * the boundary -- not the data layer.
 */

const INK = '#08090A', LIME = '#C6F24E', ALERT = '#FF2E4C'
const T2 = '#8A9195', T3 = '#7C858A', RULE = 'rgba(236,234,228,.08)'

const axis = { stroke: T3, fontSize: 10, fontFamily: 'var(--fm)', tickLine: false }
const tip = {
  contentStyle: {
    background: '#111315', border: '1px solid rgba(236,234,228,.18)',
    borderRadius: 8, fontFamily: 'var(--fm)', fontSize: 11, color: '#ECEAE4',
  },
  labelStyle: { color: T3, marginBottom: 4 },
  cursor: { fill: 'rgba(236,234,228,.04)' },
}
const money = (c: number) => `€${(c / 100).toFixed(2)}`

/* ── Placement over time ─────────────────────────────────────────────────
   Two series that share an x-axis but nothing else, so they get their own
   y-axes: the share of products you win is a percentage pinned to 0..100, the
   median gap is a signed percentage that fits its own range. */
export function PlacementChart({ rows }: {
  rows: { day: string; win_pct: number; median_gap: string | number | null }[]
}) {
  if (rows.length < 2) return <p className="empty">Not enough history yet.</p>
  const data = rows.map(r => ({
    day: r.day.slice(5),
    win: r.win_pct ?? 0,
    gap: Number(r.median_gap ?? 0),
  }))
  return (
    <ResponsiveContainer width="100%" height={250}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="winFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LIME} stopOpacity={0.30} />
            <stop offset="100%" stopColor={LIME} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={RULE} vertical={false} />
        <XAxis dataKey="day" {...axis} minTickGap={48} axisLine={{ stroke: RULE }} />
        <YAxis yAxisId="w" domain={[0, 100]} unit="%" {...axis} axisLine={false} width={44} />
        <YAxis yAxisId="g" orientation="right" unit="%" {...axis} axisLine={false} width={44} />
        <Tooltip {...tip} formatter={(v, n) =>
          [`${Number(v)}%`, n === 'win' ? 'Products you win' : 'Median gap'] as [string, string]} />
        <ReferenceLine yAxisId="g" y={0} stroke={T3} strokeDasharray="4 4" />
        <Area yAxisId="w" dataKey="win" name="win" stroke={LIME} strokeWidth={2}
              fill="url(#winFill)" dot={false} isAnimationActive={false} />
        <Line yAxisId="g" dataKey="gap" name="gap" stroke={T2} strokeWidth={1.4}
              strokeDasharray="3 3" dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/* ── Gap per product: a diverging bar, cheapest to most undercut ───────── */
export function GapChart({ rows }: {
  rows: { title: string; gap_pct: number | string | null }[]
}) {
  if (!rows.length) return <p className="empty">No confirmed matches yet.</p>
  const data = rows.map(r => ({
    name: r.title.length > 22 ? r.title.slice(0, 21) + '…' : r.title,
    gap: Number(r.gap_pct ?? 0),
  }))
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={RULE} horizontal={false} />
        <XAxis type="number" unit="%" {...axis} axisLine={{ stroke: RULE }} />
        <YAxis type="category" dataKey="name" {...axis} width={140}
               axisLine={false} interval={0} />
        <Tooltip {...tip} formatter={(v) =>
          [`${Number(v)}%`, 'vs cheapest rival'] as [string, string]} />
        <ReferenceLine x={0} stroke={T3} />
        <Bar dataKey="gap" radius={[0, 3, 3, 0]} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.gap > 0 ? ALERT : LIME} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ── Crawl volume per day ────────────────────────────────────────────────── */
export function ActivityChart({ rows }: {
  rows: { day: string; runs: number; failed: number }[]
}) {
  if (!rows.length) return <p className="empty">No runs in this window.</p>
  const data = rows.map(r => ({ day: r.day.slice(5), ok: r.runs - r.failed, failed: r.failed }))
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid stroke={RULE} vertical={false} />
        <XAxis dataKey="day" {...axis} minTickGap={40} axisLine={{ stroke: RULE }} />
        <YAxis {...axis} axisLine={false} width={38} allowDecimals={false} />
        <Tooltip {...tip} />
        <Bar dataKey="ok" name="succeeded" stackId="a" fill={T3} isAnimationActive={false} />
        <Bar dataKey="failed" name="with an error" stackId="a" fill={ALERT}
             radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ── Alerts per week, by severity ───────────────────────────────────────── */
export function AlertsChart({ rows }: {
  rows: { week: string; critical: number; warning: number; info: number }[]
}) {
  if (!rows.length) return <p className="empty">No alerts in this window.</p>
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={rows} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid stroke={RULE} vertical={false} />
        <XAxis dataKey="week" {...axis} axisLine={{ stroke: RULE }} />
        <YAxis {...axis} axisLine={false} width={38} allowDecimals={false} />
        <Tooltip {...tip} />
        <Legend wrapperStyle={{ fontFamily: 'var(--fm)', fontSize: 10, color: T3 }} />
        <Bar dataKey="critical" stackId="s" fill={ALERT} isAnimationActive={false} />
        <Bar dataKey="warning" stackId="s" fill={LIME} isAnimationActive={false} />
        <Bar dataKey="info" stackId="s" fill={T3} radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ── Per store: listings watched, and how often that store is cheapest ──── */
export function StoreChart({ rows }: {
  rows: { store: string; listings: number; cheapest_on: number }[]
}) {
  if (!rows.length) return <p className="empty">No matched listings yet.</p>
  return (
    <ResponsiveContainer width="100%" height={Math.max(150, rows.length * 52)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={RULE} horizontal={false} />
        <XAxis type="number" {...axis} axisLine={{ stroke: RULE }} allowDecimals={false} />
        <YAxis type="category" dataKey="store" {...axis} width={120} axisLine={false} interval={0} />
        <Tooltip {...tip} />
        <Legend wrapperStyle={{ fontFamily: 'var(--fm)', fontSize: 10, color: T3 }} />
        <Bar dataKey="listings" name="listings watched" fill={T3}
             radius={[0, 3, 3, 0]} isAnimationActive={false} />
        <Bar dataKey="cheapest_on" name="cheapest on" fill={LIME}
             radius={[0, 3, 3, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ── Inline sparkline for a table row ───────────────────────────────────── */
export function Spark({ series, beaten }: { series: number[]; beaten?: boolean }) {
  if (!series || series.length < 2) return <span className="spark-none">—</span>
  const data = series.map((v, i) => ({ i, v }))
  return (
    <div style={{ width: 120, height: 28 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 3, right: 2, bottom: 3, left: 2 }}>
          <Tooltip {...tip} formatter={(v) =>
                     [money(Number(v)), 'cheapest rival'] as [string, string]}
                   labelFormatter={() => ''} />
          <Line dataKey="v" stroke={beaten ? ALERT : T2} strokeWidth={1.5}
                dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── Where you stand today, as one proportional bar ─────────────────────── */
export function PositionBar({ rows }: { rows: { position: string }[] }) {
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
