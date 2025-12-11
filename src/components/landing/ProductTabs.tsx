'use client'

import { useState } from 'react'
import { Media } from './Media'

/**
 * The hero's tab switcher and stage.
 *
 * On the reference this is five tabs above a single 1046x744 still, with six
 * labelled pills pinned around its edges naming the feature each region shows.
 *
 * The stage here is deliberately EMPTY. It used to hold a hand-built DOM mock
 * of the dashboard, which is the wrong thing in a portfolio piece: it looks
 * like a screenshot without being one, so it quietly overstates what exists.
 * Each tab names the capture that belongs in its slot instead. The recorder in
 * scripts/record/ produces exactly these frames once there is a Supabase
 * project behind /app.
 */
type Pane = 'overview' | 'alerts' | 'matches' | 'billing' | 'run'

const TABS: {
  id: Pane; label: string; note: string; shot: string; hint: string
}[] = [
  { id: 'overview', label: 'Overview', note: 'Every product, every rival, one number',
    shot: 'Dashboard overview', hint: '/app — metric row, six-month chart, the crossing' },
  { id: 'alerts', label: 'Alerts', note: 'Only the crossings, never the noise',
    shot: 'Alert feed', hint: '/app/alerts — critical, warning and stock rows' },
  { id: 'matches', label: 'Matches', note: 'Nothing is matched without a human',
    shot: 'Match review', hint: '/app/matches — confidence, reason, confirm / reject' },
  { id: 'billing', label: 'Billing', note: 'The meter that actually stops you',
    shot: 'Plan and usage', hint: '/app/billing — usage meter filling to the cap' },
  { id: 'run', label: 'Night run', note: 'Crawlers out at 02:00, home by 04:48',
    shot: 'Crawl run log', hint: '/app — overnight run with per-store timings' },
]

/** The six labelled pins the reference anchors around its hero still. */
const PINS = [
  { t: 'Nightly crawl runs', c: 'pin-tl' },
  { t: 'Confidence scoring', c: 'pin-tr' },
  { t: 'Undercut detection', c: 'pin-ml' },
  { t: 'Email + Slack delivery', c: 'pin-mr' },
  { t: 'Six months of history', c: 'pin-bl' },
  { t: 'Per-tenant isolation', c: 'pin-br' },
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
          >{t.label}</button>
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

        {/* Pinned feature labels, as on the reference. Hidden below the width
            where there is margin to hang them in. */}
        <div className="pins" aria-hidden="true">
          {PINS.map(p => <span className={`pin ${p.c}`} key={p.t}>{p.t}</span>)}
        </div>
      </div>
    </div>
  )
}
