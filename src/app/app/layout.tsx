import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LayoutDashboard, Package, Store, GitCompareArrows, Bell, CreditCard, ShieldCheck } from 'lucide-react'
import { getMemberships, getActiveOrg } from '@/lib/auth/org'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { SetupNotice } from '@/components/app/SetupNotice'
import { OrgSwitcher } from '@/components/app/OrgSwitcher'
import './app.css'

const NAV = [
  { href: '/app', label: 'Overview', Icon: LayoutDashboard },
  { href: '/app/products', label: 'Products', Icon: Package },
  { href: '/app/competitors', label: 'Competitors', Icon: Store },
  { href: '/app/matches', label: 'Matches', Icon: GitCompareArrows },
  { href: '/app/alerts', label: 'Alerts', Icon: Bell },
  { href: '/app/billing', label: 'Billing', Icon: CreditCard },
] as const

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <SetupNotice />

  const memberships = await getMemberships()
  const active = await getActiveOrg()
  if (!active) redirect('/onboarding')

  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="aside">
        <span className="brand">Price<b>vane</b></span>
        <OrgSwitcher memberships={memberships} active={active} />
        <nav className="navgrp" aria-label="Sections">
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href}><Icon aria-hidden />{label}</Link>
          ))}
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <Link href="/architecture" className="who"
                style={{ fontFamily: 'var(--fm)', fontSize: 9.5, letterSpacing: '.18em',
                         textTransform: 'uppercase', color: 'var(--t3)', textDecoration: 'none',
                         display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <ShieldCheck size={13} aria-hidden /> How this works
          </Link>
        </div>
      </aside>
      <main className="pane" id="main">{children}</main>
    </div>
  )
}
