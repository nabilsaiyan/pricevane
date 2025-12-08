'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * One frame, four panes.
 *
 * Orshot, Featurebase and Openlayer all do this: a tab strip above a single
 * product frame, swapping the pane underneath. It buys four screens of product
 * in one fold with no scrolling, and it is far cheaper than four scroll beats.
 *
 * The panes are live DOM, not screenshots. Two reasons. A screenshot of a
 * dashboard goes stale the first time someone moves a button, and nobody
 * notices for a year. And a pane built in DOM can animate on entry -- the
 * counters count, the meter fills, the row lands -- which is the whole point
 * of showing the product moving rather than showing a picture of it.
 *
 * When there is a Supabase project and the recorder in scripts/record/ has
 * real footage, these panes are the natural place for it: swap the pane body
 * for <ProductClip> and keep the tab strip exactly as it is.
 */

type Pane = 'overview' | 'alerts' | 'matches' | 'billing'

type Anno = { text: string; top: string }

const TABS: {
  id: Pane; label: string; note: string
  /** Margin annotations, aimed at this pane specifically. */
  left: Anno; right: Anno
}[] = [
  { id: 'overview', label: 'Overview', note: 'Every product, every rival, one number',
    left:  { text: 'what moved\nwhile you slept', top: '27%' },
    right: { text: 'still under you,\neleven days on', top: '63%' } },
  { id: 'alerts', label: 'Alerts', note: 'Only the crossings, never the noise',
    left:  { text: 'critical means\nit actually crossed', top: '26%' },
    right: { text: 'and when,\nto the second', top: '32%' } },
  { id: 'matches', label: 'Matches', note: 'Nothing is matched without a human',
    left:  { text: 'the model\u2019s reason,\nin its own words', top: '44%' },
    right: { text: '0.61 waits\nfor a human', top: '61%' } },
  { id: 'billing', label: 'Billing', note: 'The meter that actually stops you',
    left:  { text: 'tiered on products,\nnot on seats', top: '26%' },
    right: { text: 'at 350 the database\nrefuses the insert', top: '62%' } },
]

/** Renders "a\nb" as two lines. */
function lines(s: string) {
  return s.split('\n').map((l, i) => (
    <span key={i}>{i > 0 && <br />}{l}</span>
  ))
}

/** Counts to a target once, when it first becomes visible. */
function useCountUp(target: number, run: boolean, ms = 900) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!run) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(target); return }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      // Ease out: the number should arrive and settle, not slam.
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, run, ms])
  return n
}

export function ProductTabs() {
  const [tab, setTab] = useState<Pane>('overview')
  const [live, setLive] = useState(false)
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setLive(true); io.disconnect() } },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const active = TABS.find((t) => t.id === tab)!

  const tracked = useCountUp(312, live)
  const moves = useCountUp(47, live)
  const cheapest = useCountUp(68, live)

  return (
    <div className="tabs" ref={host}>
      <div className="tabstrip" role="tablist" aria-label="Product areas">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`pane-${t.id}`}
            className={tab === t.id ? 'on' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="tabnote" aria-live="polite">{active.note}</p>

      <div className="frame" id="frame3d">
        <div className="devbar">
          <i className="dot3" /><i className="dot3" /><i className="dot3" />
          <span>app.pricevane.io/{tab === 'overview' ? '' : tab}</span>
        </div>

        <div className="paneport">
          {/* Every pane is mounted; only the selected one is shown. Keeping them
              in the DOM means the tab swap has no loading state and no layout
              jump, and `hidden` keeps the others out of the accessibility tree. */}
          <div role="tabpanel" id="pane-overview" aria-labelledby="tab-overview" hidden={tab !== 'overview'}>
            <div className="pane pane-ov">
              <div className="krow">
                <div className="k"><span className="lb">Tracked</span><div className="v">{tracked}</div></div>
                <div className="k"><span className="lb">Moves today</span><div className="v">{moves}</div></div>
                <div className="k"><span className="lb">Cheapest on</span><div className="v lime">{cheapest}%</div></div>
                <div className="k"><span className="lb">Alerts</span><div className="v alert">6</div></div>
              </div>
              <div className="chartbox">
              <svg className="chart" viewBox="0 0 600 190" preserveAspectRatio="none" role="img"
                   aria-label="Six months of price history: your line holds flat while a competitor's falls and crosses beneath it.">
                <line x1="0" y1="60" x2="600" y2="60" stroke="rgba(236,234,228,.06)" />
                <line x1="0" y1="125" x2="600" y2="125" stroke="rgba(236,234,228,.06)" />
                <path d="M0,90 L75,87 L150,92 L225,85 L300,89 L375,87 L450,91 L525,88 L600,87"
                      fill="none" stroke="#ECEAE4" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                <path d="M0,48 L75,56 L150,40 L225,64 L300,74 L360,98 L420,140 L500,152 L600,146"
                      fill="none" stroke="#C6F24E" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </svg>
                <div className="xdot" />
              </div>
            </div>
          </div>

          <div role="tabpanel" id="pane-alerts" aria-labelledby="tab-alerts" hidden={tab !== 'alerts'}>
            <div className="pane pane-al">
              <div className="alrow crit">
                <span className="sev">Critical</span>
                <div className="body">
                  <h4>Northwind dropped ErgoMesh to &euro;79.90</h4>
                  <p>&minus;10.2% &middot; &euro;9.10 under you &middot; crossed 03:14:22</p>
                </div>
                <span className="ago">4h</span>
              </div>
              <div className="alrow warn">
                <span className="sev">Warning</span>
                <div className="body">
                  <h4>Halden cut Oak Console by 6.1%</h4>
                  <p>&euro;312.00 &rarr; &euro;293.00 &middot; still &euro;18 above you</p>
                </div>
                <span className="ago">6h</span>
              </div>
              <div className="alrow">
                <span className="sev">Stock</span>
                <div className="body">
                  <h4>Vessel is out of stock on Linen Throw</h4>
                  <p>Day 3 &middot; you are the only listing in stock</p>
                </div>
                <span className="ago">11h</span>
              </div>
            </div>
          </div>

          <div role="tabpanel" id="pane-matches" aria-labelledby="tab-matches" hidden={tab !== 'matches'}>
            <div className="pane pane-ma">
              <div className="mrow">
                <div className="mtitles">
                  <b>Task Chair, Ergonomic Mesh</b>
                  <span>&harr;</span>
                  <b>ErgoMesh Office Chair &middot; Northwind</b>
                </div>
                <div className="mconf"><span className="lb">Confidence</span><b className="lime">0.94</b></div>
                <div className="macts"><span className="ok">Confirm</span><span className="no">Reject</span></div>
              </div>
              <p className="mwhy">
                &ldquo;Same seat width, same mesh back, same five-star base. Different
                photography and a different SKU convention.&rdquo;
              </p>
              <div className="mrow low">
                <div className="mtitles">
                  <b>Oak Console, 120cm</b>
                  <span>&harr;</span>
                  <b>Oak Sideboard 120 &middot; Halden</b>
                </div>
                <div className="mconf"><span className="lb">Confidence</span><b>0.61</b></div>
                <div className="macts"><span className="ok">Confirm</span><span className="no">Reject</span></div>
              </div>
              <p className="mwhy">
                &ldquo;A console and a sideboard are not the same object. The depth
                differs by 14cm.&rdquo; &mdash; held for review, never auto-applied.
              </p>
            </div>
          </div>

          <div role="tabpanel" id="pane-billing" aria-labelledby="tab-billing" hidden={tab !== 'billing'}>
            <div className="pane pane-bi">
              <div className="plan">
                <div><span className="lb">Plan</span><b>Studio</b></div>
                <div><span className="lb">Renews</span><b>14 Sept</b></div>
                <div><span className="lb">Frequency</span><b>Nightly</b></div>
              </div>
              <div className="meter">
                <div className="mtop"><span className="lb">Tracked products</span><b>312 / 350</b></div>
                <div className="mbar"><i style={{ width: live ? '89%' : '0%' }} /></div>
                <p className="mfoot">
                  At 350 the database refuses the insert. Not the interface &mdash;
                  the database.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Annotations. Humblytics writes in the margins of its own screenshot,
          which is the cheapest way to make a dashboard legible to somebody who
          has never used it.

          They live in the margin beside the frame, not on top of it. Inside,
          they landed on the pane's own labels -- an annotation that obscures
          the thing it is annotating is worse than none. They are hidden below
          1100px, where there is no margin to write in. Decorative to a screen
          reader: each one restates something already in the pane. */}
      <div className="annos" aria-hidden="true" key={tab}>
        <span className="note note-a" style={{ top: active.left.top }}>
          <span className="ntext">{lines(active.left.text)}</span>
          <svg viewBox="0 0 90 40"><path d="M4,8 C40,8 58,18 84,32" /></svg>
        </span>
        <span className="note note-b" style={{ top: active.right.top }}>
          <svg viewBox="0 0 90 40"><path d="M86,8 C50,8 32,18 6,32" /></svg>
          <span className="ntext">{lines(active.right.text)}</span>
        </span>
      </div>
    </div>
  )
}
