import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { getUsage, getOverview } from '@/lib/data/queries'
import { getActiveOrg } from '@/lib/auth/org'

export const dynamic = 'force-dynamic'

const money = (c: number | null) => c == null ? '—' : `€${(c / 100).toFixed(2)}`
const when = (s: string) => new Date(s).toLocaleString('en-GB',
  { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default async function Overview() {
  const [usage, o, org] = await Promise.all([getUsage(), getOverview(), getActiveOrg()])
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

      <div className="grid2">
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
