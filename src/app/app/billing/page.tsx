import { getUsage } from '@/lib/data/queries'
import { getActiveOrg, canManage } from '@/lib/auth/org'
import { getSupabaseServer } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { PlanActions } from '@/components/app/PlanActions'

export const dynamic = 'force-dynamic'

const TIERS = [
  { tier: 'free' as const, price: '€0', blurb: '25 products, 1 store, daily' },
  { tier: 'starter' as const, price: '€29', blurb: '250 products, 3 stores, daily' },
  { tier: 'growth' as const, price: '€79', blurb: '1 000 products, 10 stores, 4× daily' },
  { tier: 'scale' as const, price: '€249', blurb: '10 000 products, 50 stores, hourly' },
]

export default async function Billing() {
  if (!isSupabaseConfigured()) return null   // the layout renders the setup screen
  const [usage, org] = await Promise.all([getUsage(), getActiveOrg()])
  const s = await getSupabaseServer()
  const { data: sub } = await s.from('subscriptions')
    .select('current_period_end, cancel_at_period_end, past_due_since').maybeSingle()

  const pct = usage ? Math.min(100, (usage.tracked_products / usage.max_tracked_products) * 100) : 0
  const manage = org ? canManage(org.role) : false

  return (
    <>
      <div className="head">
        <div>
          <h1>Billing</h1>
          <p>Stripe test mode. Card <span style={{ fontFamily: 'var(--fm)', color: 'var(--t1)' }}>
            4242 4242 4242 4242</span>, any future expiry, any CVC.</p>
        </div>
      </div>

      {sub?.past_due_since && (
        <div className="iso" style={{ background: 'rgba(255,46,76,.07)', borderColor: 'rgba(255,46,76,.3)' }}>
          <span>
            A payment failed. Your plan stays active while Stripe retries — we do not cut service
            off on a single decline. Update the card in the portal to clear this.
          </span>
        </div>
      )}

      <div className="kpis">
        <div className="kpi"><span className="lb">Plan</span>
          <div className="v lime" style={{ fontSize: '1.35rem', paddingTop: '.3rem' }}>{usage?.tier}</div>
          <div className="d">{usage?.status}</div></div>
        <div className="kpi"><span className="lb">Renews</span>
          <div className="v" style={{ fontSize: '1.1rem', paddingTop: '.45rem' }}>
            {sub?.current_period_end
              ? new Date(sub.current_period_end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—'}
          </div>
          <div className="d">{sub?.cancel_at_period_end ? 'cancels at period end' : 'auto-renews'}</div></div>
        <div className="kpi"><span className="lb">Products</span>
          <div className="v">{usage?.tracked_products ?? 0}</div>
          <div className="d">of {usage?.max_tracked_products ?? 0}</div></div>
        <div className="kpi"><span className="lb">Stores</span>
          <div className="v">{usage?.active_stores ?? 0}</div>
          <div className="d">of {usage?.max_competitor_stores ?? 0}</div></div>
      </div>

      <section className="card" style={{ marginBottom: '1rem' }}>
        <header><h2>Usage</h2>
          <span className="lb">{pct >= 100 ? 'at limit' : `${Math.round(pct)}% used`}</span></header>
        <div style={{ padding: '1.05rem' }}>
          <div className="meter"><i className={pct > 90 ? 'hot' : ''} style={{ width: `${pct}%` }} /></div>
          <p style={{ color: 'var(--t3)', fontSize: 12, margin: '.5rem 0 0', lineHeight: 1.55 }}>
            The cap is a Postgres trigger, not a check in the API. Adding a product past the limit
            is refused by the database on every path into the table — including a direct SQL write.
          </p>
        </div>
      </section>

      <section className="card">
        <header><h2>Plans</h2>
          {!manage && <span className="lb">Only an owner or admin can change the plan</span>}</header>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
                      gap: 1, background: 'var(--rule)' }}>
          {TIERS.map(t => (
            <div key={t.tier} style={{ background: 'var(--s1)', padding: '1.05rem' }}>
              <span className="lb">{t.tier}</span>
              <div style={{ fontFamily: 'var(--fm)', fontSize: '1.6rem', letterSpacing: '-.03em',
                            margin: '.3rem 0 .1rem',
                            color: t.tier === usage?.tier ? 'var(--lime)' : 'var(--t1)' }}>
                {t.price}<span style={{ fontSize: 11, color: 'var(--t3)' }}>/mo</span>
              </div>
              <p style={{ color: 'var(--t3)', fontSize: 11.5, margin: '.35rem 0 .9rem', lineHeight: 1.45 }}>
                {t.blurb}
              </p>
              {org && (
                <PlanActions organizationId={org.organization_id} tier={t.tier}
                             current={t.tier === usage?.tier} canManage={manage} />
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
