import { ArrowRight } from 'lucide-react'
import { LandingMotion } from '@/components/landing/LandingMotion'

/**
 * The landing page is a server component: the markup below is the page a
 * visitor gets with JavaScript disabled, with reduced motion, or before the
 * bundle lands. LandingMotion attaches the choreography on top of it.
 */
export default function Home() {
  return (
    <>
      <div id="rail"><div id="railfill" /></div>

      <nav>
        <span className="wm">Price<b>vane</b></span>
        <button className="btn" type="button">Start free</button>
      </nav>

      <header className="wrap hero">
        <h1 className="x">
          You were<br />asleep.<br /><span className="lime">We weren&rsquo;t.</span>
        </h1>
        <p className="sub">
          Every competitor price, checked overnight. The board below is last night&rsquo;s run.
        </p>
        {/* Filled by LandingMotion; the static fallback is an empty rule, not a
            broken widget. */}
        <div className="board" id="board" />
      </header>

      <section className="wrap tilt-sec" id="tiltSec">
        <h2 className="x">Wake up to the answer.</h2>
        <div className="device" id="device">
          <div className="devbar">
            <i className="dot3" /><i className="dot3" /><i className="dot3" />
            <span>app.pricevane.io</span>
          </div>
          <div className="dash">
            <div className="side">
              <span className="wm" style={{ fontSize: '10.5px' }}>Price<b>vane</b></span>
              <div className="nav2">
                <i className="on">Overview</i><i>Products</i><i>Competitors</i>
                <i>Matches</i><i>Alerts</i>
              </div>
            </div>
            <div className="main">
              <div className="krow">
                <div className="k"><span className="lb">Tracked</span><div className="v">312</div></div>
                <div className="k"><span className="lb">Moves</span><div className="v">47</div></div>
                <div className="k"><span className="lb">Cheapest on</span><div className="v lime">68%</div></div>
                <div className="k"><span className="lb">Alerts</span><div className="v" style={{ color: '#FF2E4C' }}>6</div></div>
              </div>
              <svg className="chart" viewBox="0 0 600 200" preserveAspectRatio="none" role="img"
                   aria-label="Six months of price history: your price holds flat while a competitor's falls below it.">
                <line x1="0" y1="66" x2="600" y2="66" stroke="rgba(236,234,228,.07)" />
                <line x1="0" y1="133" x2="600" y2="133" stroke="rgba(236,234,228,.07)" />
                <path d="M0,96 L75,93 L150,98 L225,91 L300,95 L375,93 L450,97 L525,94 L600,93"
                      fill="none" stroke="#ECEAE4" strokeWidth="2" />
                <path d="M0,52 L75,60 L150,44 L225,68 L300,78 L360,104 L420,146 L500,158 L600,152"
                      fill="none" stroke="#C6F24E" strokeWidth="2" />
                <circle cx="392" cy="95" r="4.5" fill="#FF2E4C" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap match-sec" id="matchSec">
        <h2 className="x">Same chair.<br />Different name.</h2>
        <div className="arena">
          <div className="pcard" id="cardL">
            <div className="shot"><em>Your catalogue</em></div>
            <div className="meta">
              <h3>Task Chair, Ergonomic Mesh</h3>
              <div className="sku"><span>TC-4471-BLK</span><span>In stock</span></div>
              <div className="pz">&euro;89.00</div>
            </div>
          </div>
          <div className="lock">
            <span className="lb">Confidence</span>
            <div className="sc" id="score">0.94</div>
            <span className="lb" id="verdict">locked</span>
          </div>
          <div className="pcard" id="cardR">
            <div className="shot"><em>Northwind Supply</em></div>
            <div className="meta">
              <h3>ErgoMesh Office Chair</h3>
              <div className="sku"><span>NW-88213</span><span>In stock</span></div>
              <div className="pz lime">&euro;79.90</div>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap alert-sec">
        <h2 className="x">One number moved.<br />You got a message.</h2>
        <div className="acard">
          <span className="lb">Undercut detected</span>
          <h3>Northwind dropped ErgoMesh Office Chair to &euro;79.90</h3>
          <p className="meta">
            <b>&minus;10.2%</b> &nbsp;&middot;&nbsp; &euro;9.10 under you &nbsp;&middot;&nbsp; 03:14 CET
          </p>
        </div>
      </section>

      <section className="wrap close">
        <h2 className="x">Sleep on it.</h2>
        <div className="row">
          <button className="btn" type="button">
            Start free <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
          </button>
          <span className="lb">No card &middot; 25 products &middot; nightly checks</span>
        </div>
      </section>

      <footer className="wrap">
        <span className="lb">Pricevane &mdash; a Nabil Amhaouch project</span>
      </footer>

      <LandingMotion />
    </>
  )
}
