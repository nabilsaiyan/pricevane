'use client'

import { useState } from 'react'
import {
  Activity, BellRing, Clock4, CreditCard, Database, GitCompareArrows,
  Gauge, Mail, Radar, ShieldCheck, TrendingDown, UserCheck,
} from 'lucide-react'
import { Media } from './Media'

/**
 * The hero's tab switcher and stage.
 *
 * The stage is deliberately EMPTY. It used to hold a hand-built DOM mock of
 * the dashboard, which is the wrong thing in a portfolio piece: it looks like
 * a screenshot without being one, so it quietly overstates what exists. Each
 * tab names the capture that belongs in its slot instead. The recorder in
 * scripts/record/ produces exactly these frames.
 *
 * The pinned labels are per-tab. They used to be one fixed set of six that sat
 * there unchanged whichever tab you picked, which is worse than useless -- it
 * labels the alert feed with "Six months of history". Each tab now names what
 * is actually visible in its own capture, and each label carries the icon of
 * the thing it points at, because a row of identical text pills reads as
 * decoration rather than as annotation.
 */
type Pane = 'overview' | 'alerts' | 'matches' | 'billing' | 'run'
type Pin = { t: string; c: string; Icon: typeof Radar }

const TABS: {
  id: Pane; label: string; Icon: typeof Radar; note: string
  shot: string; hint: string; pins: Pin[]
}[] = [
  {
    id: 'overview', label: 'Overview', Icon: Gauge,
    note: 'Every product, every rival, one number',
    shot: 'Dashboard overview', hint: '/app — metric row, six-month chart, the crossing',
    pins: [
      { t: 'Products tracked', c: 'pin-tl', Icon: Database },
      { t: 'Win rate, six months', c: 'pin-tr', Icon: TrendingDown },
      { t: 'Cheapest-on-market %', c: 'pin-ml', Icon: Gauge },
      { t: 'Where you stand today', c: 'pin-mr', Icon: Activity },
      { t: 'Crawl activity, 60 days', c: 'pin-bl', Icon: Radar },
      { t: 'Biggest movers', c: 'pin-br', Icon: TrendingDown },
    ],
  },
  {
    id: 'alerts', label: 'Alerts', Icon: BellRing,
    note: 'Only the crossings, never the noise',
    shot: 'Alert feed', hint: '/app/alerts — critical, warning and stock rows',
    pins: [
      { t: 'Severity, at a glance', c: 'pin-tl', Icon: BellRing },
      { t: 'The exact minute', c: 'pin-tr', Icon: Clock4 },
      { t: 'Fires on the crossing', c: 'pin-ml', Icon: TrendingDown },
      { t: 'Email + Slack delivery', c: 'pin-mr', Icon: Mail },
      { t: 'Deduplicated by movement', c: 'pin-bl', Icon: Activity },
      { t: 'Thresholds you set', c: 'pin-br', Icon: Gauge },
    ],
  },
  {
    id: 'matches', label: 'Matches', Icon: GitCompareArrows,
    note: 'Nothing is matched without a human',
    shot: 'Match review', hint: '/app/matches — confidence, reason, confirm / reject',
    pins: [
      { t: 'Your product', c: 'pin-tl', Icon: Database },
      { t: 'Their listing', c: 'pin-tr', Icon: GitCompareArrows },
      { t: 'Confidence score', c: 'pin-ml', Icon: Gauge },
      { t: 'The reason, in words', c: 'pin-mr', Icon: Activity },
      { t: 'Confirm or reject', c: 'pin-bl', Icon: UserCheck },
      { t: 'Both answers stored', c: 'pin-br', Icon: Database },
    ],
  },
  {
    id: 'billing', label: 'Billing', Icon: CreditCard,
    note: 'The meter that actually stops you',
    shot: 'Plan and usage', hint: '/app/billing — usage meter filling to the cap',
    pins: [
      { t: 'Products against cap', c: 'pin-tl', Icon: Gauge },
      { t: 'Plan and interval', c: 'pin-tr', Icon: CreditCard },
      { t: 'Enforced in Postgres', c: 'pin-ml', Icon: ShieldCheck },
      { t: 'Stripe test mode', c: 'pin-mr', Icon: CreditCard },
      { t: 'Downgrade never traps', c: 'pin-bl', Icon: UserCheck },
      { t: 'Idempotent webhooks', c: 'pin-br', Icon: ShieldCheck },
    ],
  },
  {
    id: 'run', label: 'Night run', Icon: Radar,
    note: 'Crawlers out at 02:00, home by 04:48',
    shot: 'Crawl run log', hint: '/app — overnight run with per-store timings',
    pins: [
      { t: 'Started 02:00 UTC', c: 'pin-tl', Icon: Clock4 },
      { t: 'Per-store timings', c: 'pin-tr', Icon: Activity },
      { t: 'Rotating identities', c: 'pin-ml', Icon: ShieldCheck },
      { t: 'Rate limited, politely', c: 'pin-mr', Icon: Radar },
      { t: 'Listings captured', c: 'pin-bl', Icon: Database },
      { t: 'Finished 04:48', c: 'pin-br', Icon: Clock4 },
    ],
  },
]

export function ProductTabs() {
  const [tab, setTab] = useState<Pane>('overview')
  const active = TABS.find(t => t.id === tab)!

  return (
    <div className="tabs">
      <div className="tabstrip" role="tablist" aria-label="Product areas">
        {TABS.map(t => (
          <button
            key={t.id} role="tab" type="button" id={`tab-${t.id}`}
            aria-selected={tab === t.id} aria-controls="pane"
            className={tab === t.id ? 'on' : undefined}
            onClick={() => setTab(t.id)}
          ><t.Icon size={14} aria-hidden />{t.label}</button>
        ))}
      </div>

      <p className="tabnote" aria-live="polite">{active.note}</p>

      <div className="stage">
        <div className="frame" id="pane" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          <div className="devbar">
            <i className="dot3" /><i className="dot3" /><i className="dot3" />
            <span>app.pricevane.io/{tab === 'overview' ? '' : tab}</span>
          </div>
          <Media w={1046} h={744} label={active.shot} hint={active.hint} />
        </div>

        {/* Anchored to the frame, not to a percentage of the page. The offsets
            used to be percentages, so on a wide display the labels drifted off
            toward the window edges and stopped reading as annotations of the
            thing they point at. */}
        <div className="pins" aria-hidden="true">
          {active.pins.map(p => (
            <span className={`pin ${p.c}`} key={p.c}>
              <p.Icon size={13} aria-hidden />{p.t}
            </span>
          ))}
        </div>
      </div>

      {/* Below the width that has margin to hang labels in, the same list
          becomes a row under the frame. It used to simply vanish, which threw
          away the annotation entirely on every laptop and phone. */}
      <ul className="pinrow" aria-label="What this view shows">
        {active.pins.map(p => (
          <li key={p.c}><p.Icon size={13} aria-hidden />{p.t}</li>
        ))}
      </ul>
    </div>
  )
}
