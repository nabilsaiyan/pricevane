'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Bell, ChevronDown, CreditCard, Database, GitCompareArrows,
  Lock, Radar, ScrollText, Store, Terminal,
} from 'lucide-react'

/**
 * The site header, with mega-menu panels.
 *
 * Opens on hover for a pointer and on click for everything else, because a
 * hover-only menu is unreachable by keyboard and unusable on a touchscreen.
 * Escape closes, focus leaving the header closes, and each trigger carries
 * aria-expanded so a screen reader is told the same thing the arrow is saying.
 *
 * The panel is one grid of described links rather than a bare list: a menu item
 * that needs a sentence to explain it should be allowed one.
 */
type Item = { href: string; label: string; desc: string; Icon: typeof Radar }
type Menu = { id: string; label: string; items: Item[]; foot?: { href: string; label: string } }

const MENUS: Menu[] = [
  {
    id: 'product', label: 'Product',
    items: [
      { href: '#ch1', label: 'Nightly monitoring', desc: 'Crawlers out at 02:00, home by 04:48', Icon: Radar },
      { href: '#ch2', label: 'Product matching', desc: 'Confidence, a reason, then a human', Icon: GitCompareArrows },
      { href: '#ch3', label: 'Alerts', desc: 'Only the crossings, never the noise', Icon: Bell },
      { href: '#ch4', label: 'Tenant isolation', desc: 'The database refuses, not the code', Icon: Lock },
    ],
    foot: { href: '#pricingSec', label: 'See pricing' },
  },
  {
    id: 'engineering', label: 'Engineering',
    items: [
      { href: '/architecture', label: 'Architecture', desc: 'The three decisions worth explaining', Icon: ScrollText },
      { href: '/architecture', label: 'Row-level security', desc: 'Every policy, and why it exists', Icon: Database },
      { href: '/architecture', label: 'Billing ledger', desc: 'Why a replayed webhook cannot double-apply', Icon: CreditCard },
      { href: '/architecture', label: 'Crawler design', desc: 'Identities that rotate together', Icon: Terminal },
    ],
    foot: { href: '/architecture', label: 'Read the write-up' },
  },
]

export function SiteNav() {
  const [open, setOpen] = useState<string | null>(null)
  const ref = useRef<HTMLElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    const onOut = (e: FocusEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onOut)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onOut)
    }
  }, [])

  // A small close delay: without it, crossing the gap between the trigger and
  // the panel snaps the menu shut mid-reach.
  const hold = (id: string | null) => {
    if (timer.current) clearTimeout(timer.current)
    if (id) setOpen(id)
    else timer.current = setTimeout(() => setOpen(null), 140)
  }

  return (
    <nav className="topnav" ref={ref} onMouseLeave={() => hold(null)}>
      <a href="/" className="wm">Price<b>vane</b></a>

      <div className="navmid">
        {MENUS.map(m => (
          <div className="navitem" key={m.id} onMouseEnter={() => hold(m.id)}>
            <button
              type="button"
              className={`navlink trig${open === m.id ? ' on' : ''}`}
              aria-expanded={open === m.id}
              aria-controls={`menu-${m.id}`}
              onClick={() => setOpen(open === m.id ? null : m.id)}
            >
              {m.label}<ChevronDown size={14} aria-hidden />
            </button>

            <div className="mega" id={`menu-${m.id}`} hidden={open !== m.id}>
              <div className="megagrid">
                {m.items.map(({ href, label, desc, Icon }) => (
                  <a href={href} key={label} className="megaitem" onClick={() => setOpen(null)}>
                    <span className="megaico"><Icon size={16} aria-hidden /></span>
                    <span><b>{label}</b><em>{desc}</em></span>
                  </a>
                ))}
              </div>
              {m.foot && (
                <a href={m.foot.href} className="megafoot" onClick={() => setOpen(null)}>
                  {m.foot.label} <span aria-hidden>&rarr;</span>
                </a>
              )}
            </div>
          </div>
        ))}

        <a className="navlink" href="#storiesSec">Customers</a>
        <a className="navlink" href="#pricingSec">Pricing</a>
      </div>

      <div className="navr">
        <a className="navlink" href="/sign-in">Log in</a>
        <a className="btn" href="/sign-in">Start free</a>
      </div>
    </nav>
  )
}
