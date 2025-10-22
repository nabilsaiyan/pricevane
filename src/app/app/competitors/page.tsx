import { getSupabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Competitors() {
  const s = await getSupabaseServer()
  const [{ data: stores }, { data: runs }] = await Promise.all([
    s.from('competitor_stores').select('id, name, base_url, domain, crawl_interval_minutes, is_active'),
    s.from('crawl_runs')
      .select('id, status, started_at, finished_at, listings_seen, proxy_label, locale, timezone, store_id')
      .order('started_at', { ascending: false }).limit(12),
  ])

  const when = (v: string | null) => v
    ? new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'
  const name = (id: string | null) => stores?.find(s2 => s2.id === id)?.name ?? '—'

  return (
    <>
      <div className="head">
        <div>
          <h1>Competitors</h1>
          <p>Fictional storefronts built and deployed for this project. No real retailer is crawled.</p>
        </div>
      </div>

      <section className="card" style={{ marginBottom: '1rem' }}>
        <header><h2>Stores</h2></header>
        <table className="t">
          <thead><tr><th>Store</th><th>Domain</th>
            <th style={{ textAlign: 'right' }}>Interval</th>
            <th style={{ textAlign: 'right' }}>State</th></tr></thead>
          <tbody>
            {(stores ?? []).map(st => (
              <tr key={st.id}>
                <td style={{ color: 'var(--t1)' }}>{st.name}</td>
                <td style={{ fontFamily: 'var(--fm)', fontSize: 11.5 }}>{st.domain}</td>
                <td className="n">{Math.round(st.crawl_interval_minutes / 60)}h</td>
                <td className="n"><span className={`pill ${st.is_active ? 'warn' : 'ok'}`}>
                  {st.is_active ? 'active' : 'paused'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <header>
          <h2>Recent crawl runs</h2>
          <span className="lb">Identity rotates as a unit — proxy, locale and timezone together</span>
        </header>
        <table className="t">
          <thead><tr><th>Started</th><th>Store</th><th>Identity</th>
            <th style={{ textAlign: 'right' }}>Listings</th>
            <th style={{ textAlign: 'right' }}>Result</th></tr></thead>
          <tbody>
            {(runs ?? []).map(r => (
              <tr key={r.id}>
                <td style={{ fontFamily: 'var(--fm)', fontSize: 11.5 }}>{when(r.started_at)}</td>
                <td style={{ color: 'var(--t1)' }}>{name(r.store_id)}</td>
                <td style={{ fontFamily: 'var(--fm)', fontSize: 11 }}>
                  {r.proxy_label} · {r.locale} · {r.timezone}
                </td>
                <td className="n">{r.listings_seen}</td>
                <td className="n">
                  <span className={`pill ${r.status === 'succeeded' ? 'ok' : 'crit'}`}>{r.status}</span>
                </td>
              </tr>
            ))}
            {(runs ?? []).length === 0 && (
              <tr><td colSpan={5}><div className="empty">No crawl runs recorded.</div></td></tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}
