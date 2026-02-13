import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LayoutDashboard, Package, Store, GitCompareArrows, Bell, CreditCard, Settings2, ShieldCheck } from 'lucide-react'
import { getMemberships, getActiveOrg } from '@/lib/auth/org'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { SetupNotice } from '@/components/app/SetupNotice'
import { isLocalAuth, getLocalUserId } from '@/lib/auth/local'
import { OrgSwitcher } from '@/components/app/OrgSwitcher'
import './app.css'
import { Mark } from '@/components/Logo'

const NAV = [
  { href: '/app', label: 'Overview', Icon: LayoutDashboard },
  { href: '/app/products', label: 'Products', Icon: Package },
  { href: '/app/competitors', label: 'Competitors', Icon: Store },
  { href: '/app/matches', label: 'Matches', Icon: GitCompareArrows },
  { href: '/app/alerts', label: 'Alerts', Icon: Bell },
  { href: '/app/billing', label: 'Billing', Icon: CreditCard },
  { href: '/app/settings', label: 'Settings', Icon: Settings2 },
] as const

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Local development has no Supabase project but does have a real database
  // and a real identity, so the setup screen would be a lie. Unauthenticated
  // callers go to the sign-in picker instead.
  if (isLocalAuth()) {
    if (!(await getLocalUserId())) redirect('/sign-in')
  } else if (!isSupabaseConfigured()) {
    return <SetupNotice />
  }

  const memberships = await getMemberships()
  const active = await getActiveOrg()
  if (!active) redirect('/onboarding')

  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="aside">
        {/* The wordmark is the way back out of the app. It was a bare <span>,
            which is the one thing every user tries first. */}
        <Link href="/" className="brand" aria-label="Pricevane home">
          <Mark size={22} /><span>Price<b>vane</b></span>
        </Link>
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
