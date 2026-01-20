import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import {
  getUsage, getOverview, getPriceIndex, getPosition,
  getSparklines, getCrawlActivity, getMovers,
  getAlertBreakdown, getStoreBreakdown,
} from '@/lib/data/queries'
import { getActiveOrg } from '@/lib/auth/org'
import {
  PlacementChart, GapChart, ActivityChart, AlertsChart, StoreChart,
  PositionBar, Spark,
} from '@/components/app/Charts'

export const dynamic = 'force-dynamic'

const money = (c: number | null) => c == null ? '—' : `€${(c / 100).toFixed(2)}`
const when = (s: string) => new Date(s).toLocaleString('en-GB',
  { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default async function Overview() {
  const [usage, o, org, index, position, sparks, activity, movers,
         alertMix, storeMix] = await Promise.all([
    getUsage(), getOverview(), getActiveOrg(),
    getPriceIndex(), getPosition(), getSparklines(), getCrawlActivity(), getMovers(),
    getAlertBreakdown(), getStoreBreakdown(),
  ]) as [
    Awaited<ReturnType<typeof getUsage>>, Awaited<ReturnType<typeof getOverview>>,
    Awaited<ReturnType<typeof getActiveOrg>>,
    { day: string; tracked: number; winning: number; win_pct: number;
      median_gap: string | number | null }[],
    { id: string; title: string; our_price_cents: number; best_rival: number;
      position: string; gap_pct: number | null }[],
    { id: string; title: string; our_price_cents: number; series: number[] }[],
    { day: string; runs: number; failed: number }[],
    { title: string; store: string; from_cents: number; to_cents: number; pct: number }[],
    { week: string; critical: number; warning: number; info: number }[],
    { store: string; listings: number; cheapest_on: number }[],
  ]
  const pct = usage ? Math.min(100, (usage.tracked_products / usage.max_tracked_products) * 100) : 0

  return (
    <>
      <div className="head">
        <div>
          <h1>Overview</h1>
          <p>{o.lastRun
            ? `Last crawl ${when(o.lastRun.started_at)} — ${o.lastRun.listings_seen} listings, ${o.lastRun.status}.`
            : 'No crawl has run yet.'}</p>
        </div>
      </div>

      {org?.organizations.is_demo && (
        <div className="iso">
          <ShieldCheck aria-hidden />
          <span>
            You are in <b>{org.organizations.name}</b>. Every figure on this page is scoped to it by
            a Postgres row-level security policy — switch workspace and none of this data follows you.{' '}
            <Link href="/architecture" style={{ color: 'var(--lime)' }}>How that is enforced</Link>.
          </span>
        </div>
      )}

      <div className="kpis">
        <div className="kpi">
          <span className="lb">Tracked products</span>
          <div className="v">{usage?.tracked_products ?? 0}</div>
          <div className="d">of {usage?.max_tracked_products ?? 0} on {usage?.tier ?? 'free'}</div>
        </div>
        <div className="kpi">
          <span className="lb">Competitor stores</span>
          <div className="v">{usage?.active_stores ?? 0}</div>
          <div className="d">checked {usage?.checks_per_day ?? 1}× a day</div>
        </div>
        <div className="kpi">
          <span className="lb">Unread alerts</span>
          <div className="v" style={{ color: o.unreadAlerts ? 'var(--alert)' : undefined }}>
            {o.unreadAlerts}
          </div>
          <div className="d">across all rules</div>
        </div>
        <div className="kpi">
          <span className="lb">Plan</span>
          <div className="v lime" style={{ fontSize: '1.3rem', paddingTop: '.35rem' }}>
            {usage?.tier ?? 'free'}
          </div>
          <div className="d">{usage?.status ?? '—'}</div>
        </div>
      </div>

      {/* The chart the product exists for: your price against the cheapest
          rival, every day of the window. A price-monitoring dashboard without
          this is a list of numbers pretending to be a product. */}
      <section className="card chart-card">
        <header>
          <h2>How you are placed</h2>
          <span className="lb">{index.length} days</span>
        </header>
        <div className="card-pad"><PlacementChart rows={index} /></div>
      </section>

      <div className="grid2">
        <section className="card">
          <header><h2>Where you stand today</h2><span className="lb">{position.length} matched</span></header>
          <div className="card-pad">
            <PositionBar rows={position} />
            <GapChart rows={position} />
            <ul className="poslist" hidden>
              {position.slice(0, 5).map(p => (
                <li key={p.id} className={p.position}>
                  <span className="pt">{p.title}</span>
                  <span className="pg">
                    {p.gap_pct == null ? '—'
                      : p.gap_pct > 0 ? `+${p.gap_pct}%` : `${p.gap_pct}%`}
                  </span>
                </li>
              ))}
              {position.length === 0 && <li className="empty">No confirmed matches yet.</li>}
            </ul>
          </div>
        </section>

        <section className="card">
          <header><h2>Crawl activity</h2><span className="lb">60 days</span></header>
          <div className="card-pad">
            <ActivityChart rows={activity} />
            <p className="chart-note">
              {activity.reduce((n, r) => n + r.runs, 0)} runs,{' '}
              {activity.reduce((n, r) => n + r.failed, 0)} with an error.
            </p>
          </div>
        </section>
      </div>

      <div className="grid2" style={{ marginTop: '1rem' }}>
        <section className="card">
          <header><h2>Competitor stores</h2><span className="lb">matched listings</span></header>
          <div className="card-pad"><StoreChart rows={storeMix} /></div>
        </section>

        <section className="card">
          <header><h2>Alerts by severity</h2><span className="lb">12 weeks</span></header>
          <div className="card-pad">
            <AlertsChart rows={alertMix} />
            <p className="chart-note">
              {alertMix.reduce((n, r) => n + r.critical + r.warning + r.info, 0)} alerts
              in this window. Sparse because the engine has been run once against
              the seeded history, not nightly.
            </p>
          </div>
        </section>
      </div>

      <div className="grid2" style={{ marginTop: '1rem' }}>
        <section className="card">
          <header><h2>Price trend, 60 days</h2><span className="lb">cheapest rival</span></header>
          <table className="t">
            <tbody>
              {sparks.map(sp => {
                const last = sp.series[sp.series.length - 1]
                const beaten = last != null && sp.our_price_cents != null && last < sp.our_price_cents
                return (
                  <tr key={sp.id}>
                    <td style={{ color: 'var(--t1)' }}>{sp.title}</td>
                    <td style={{ width: 130 }}><Spark series={sp.series} beaten={beaten} /></td>
                    <td className="n mono" style={{ fontFamily: 'var(--fm)', fontSize: 12,
                        color: beaten ? 'var(--alert)' : 'var(--t2)' }}>
                      {money(last)}
                    </td>
                  </tr>
                )
              })}
              {sparks.length === 0 && (
                <tr><td><div className="empty">No matched history yet.</div></td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="card">
          <header><h2>Biggest movers</h2><span className="lb">14 days</span></header>
          <table className="t">
            <tbody>
              {movers.map((m, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--t1)' }}>{m.title}
                    <span className="sub">{m.store}</span></td>
                  <td className="n mono" style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--t3)' }}>
                    {money(m.from_cents)} → {money(m.to_cents)}
                  </td>
                  <td className="n mono" style={{ fontFamily: 'var(--fm)', fontSize: 12,
                      color: m.pct < 0 ? 'var(--alert)' : 'var(--lime)' }}>
                    {m.pct > 0 ? `+${m.pct}` : m.pct}%
                  </td>
                </tr>
              ))}
              {movers.length === 0 && (
                <tr><td><div className="empty">Nothing has moved.</div></td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <div className="grid2" style={{ marginTop: '1rem' }}>
        <section className="card">
          <header><h2>Recent alerts</h2><Link href="/app/alerts" className="lb">All →</Link></header>
          {o.alerts.length === 0
            ? <div className="empty">Nothing has moved yet.</div>
            : (
              <table className="t">
                <tbody>
                  {o.alerts.map(a => (
                    <tr key={a.id}>
                      <td>
                        <span className={`pill ${a.severity === 'critical' ? 'crit' : a.severity === 'warning' ? 'warn' : 'ok'}`}>
                          {a.kind.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ color: 'var(--t1)' }}>{a.title}</td>
                      <td className="n" style={{ whiteSpace: 'nowrap', color: 'var(--t3)', fontSize: 11 }}>
                        {when(a.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </section>

        <section className="card">
          <header><h2>Plan usage</h2><Link href="/app/billing" className="lb">Billing →</Link></header>
          <div style={{ padding: '1.05rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--t2)' }}>Tracked products</span>
              <span className="mono" style={{ fontFamily: 'var(--fm)', fontVariantNumeric: 'tabular-nums' }}>
                {usage?.tracked_products ?? 0} / {usage?.max_tracked_products ?? 0}
              </span>
            </div>
            <div className="meter"><i className={pct > 90 ? 'hot' : ''} style={{ width: `${pct}%` }} /></div>
            <p style={{ color: 'var(--t3)', fontSize: 12, margin: '.5rem 0 0' }}>
              {pct >= 100
                ? 'At the limit. The database refuses new tracked products until you upgrade.'
                : `${(usage?.max_tracked_products ?? 0) - (usage?.tracked_products ?? 0)} left on this plan.`}
            </p>
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: '1rem' }}>
        <header><h2>Competitor stores</h2></header>
        <table className="t">
          <thead><tr><th>Store</th><th>Domain</th><th style={{ textAlign: 'right' }}>State</th></tr></thead>
          <tbody>
            {o.stores.map(s => (
              <tr key={s.id}>
                <td style={{ color: 'var(--t1)' }}>{s.name}</td>
                <td className="mono" style={{ fontFamily: 'var(--fm)', fontSize: 11.5 }}>{s.domain}</td>
                <td className="n">
                  <span className={`pill ${s.is_active ? 'warn' : 'ok'}`}>{s.is_active ? 'active' : 'paused'}</span>
                </td>
              </tr>
            ))}
            {o.stores.length === 0 && (
              <tr><td colSpan={3}><div className="empty">No competitor stores yet.</div></td></tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}
export { money }
