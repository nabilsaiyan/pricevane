import { getAlerts } from '@/lib/data/queries'

export const dynamic = 'force-dynamic'

const when = (s: string) => new Date(s).toLocaleString('en-GB',
  { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default async function Alerts() {
  const alerts = await getAlerts()

  return (
    <>
      <div className="head">
        <div>
          <h1>Alerts</h1>
          <p>{alerts.length} in the last window. Red is reserved for undercuts — nothing else uses it.</p>
        </div>
      </div>

      <section className="card">
        <table className="t">
          <thead>
            <tr>
              <th>Kind</th><th>What happened</th>
              <th style={{ textAlign: 'right' }}>Was</th>
              <th style={{ textAlign: 'right' }}>Now</th>
              <th style={{ textAlign: 'right' }}>Δ</th>
              <th style={{ textAlign: 'right' }}>When</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map(a => {
              const delta = a.old_price_cents && a.new_price_cents
                ? ((a.new_price_cents - a.old_price_cents) / a.old_price_cents) * 100 : null
              return (
                <tr key={a.id}>
                  <td>
                    <span className={`pill ${a.severity === 'critical' ? 'crit' : a.severity === 'warning' ? 'warn' : 'ok'}`}>
                      {a.kind.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ color: 'var(--t1)' }}>{a.title}</td>
                  <td className="n">{a.old_price_cents ? `€${(a.old_price_cents / 100).toFixed(2)}` : '—'}</td>
                  <td className="n">{a.new_price_cents ? `€${(a.new_price_cents / 100).toFixed(2)}` : '—'}</td>
                  <td className={`n ${delta == null ? '' : delta < 0 ? 'dn' : 'up'}`}>
                    {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}
                  </td>
                  <td className="n" style={{ color: 'var(--t3)', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {when(a.created_at)}
                  </td>
                </tr>
              )
            })}
            {alerts.length === 0 && (
              <tr><td colSpan={6}><div className="empty">Nothing has moved yet.</div></td></tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}
