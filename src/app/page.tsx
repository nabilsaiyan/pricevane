import Image from 'next/image'
import { Hash, Mail } from 'lucide-react'
import { LandingMotion } from '@/components/landing/LandingMotion'

/**
 * Six scroll beats, almost no prose. The product's own material -- plotted
 * lines, a clock running through the night, tabular figures, two photographs
 * of one chair -- carries the argument, so the copy does not have to.
 *
 * Server component: this markup is the page you get with JavaScript off or
 * reduced motion on, and it reads as a finished design rather than a stalled
 * animation. LandingMotion layers the choreography on top.
 */
export default function Home() {
  return (
    <>
      <div id="rail"><div id="railfill" /></div>

      <nav>
        <span className="wm">Price<b>vane</b></span>
        <button className="btn" type="button">Start free</button>
      </nav>

      {/* 1 — the duel */}
      <header className="hero">
        <svg id="duel" viewBox="0 0 1440 800" preserveAspectRatio="none" role="img"
             aria-label="Your price holds flat while a competitor's price falls and crosses beneath it at 03:14.">
          <path id="mine" d="M0,392 L180,388 L360,396 L540,386 L720,392 L900,389 L1080,394 L1260,390 L1440,388" />
          <path id="theirs" d="M0,250 L180,272 L360,222 L540,300 L720,330 L860,392 L960,470 L1130,556 L1290,570 L1440,562" />
          <g className="xpt" id="xpt">
            <circle cx="882" cy="391" r="16" fill="none" stroke="#FF2E4C" strokeWidth="1.5" />
            <circle cx="882" cy="391" r="4.5" fill="#FF2E4C" />
          </g>
        </svg>

        <div className="acard" id="acard">
          <span className="lb">Undercut</span>
          <h3>Northwind dropped ErgoMesh to &euro;79.90</h3>
          <p className="m"><b>&minus;10.2%</b> &nbsp;&middot;&nbsp; &euro;9.10 under you &nbsp;&middot;&nbsp; 03:14</p>
        </div>

        <div className="axis xpt" id="axis">
          <div className="p">&euro;89.00</div>
          <div className="p lime">&euro;79.90</div>
        </div>

        <div className="hero-txt">
          <h1 className="x">
            <span><i>You were</i></span>
            <span><i>asleep.</i></span>
            <span><i className="lime">We weren&rsquo;t.</i></span>
          </h1>
          <div className="hero-cta" id="hcta">
            <button className="btn" type="button">Start free</button>
            <span className="lb">25 products &middot; no card</span>
          </div>
        </div>
      </header>

      {/* 2 — the night run */}
      <section className="night" id="night">
        <div className="night-pin wrap">
          <span className="lb">Last night</span>
          <div className="clock" id="clock">02:00<b>:00</b></div>
          <div className="nrun">
            <svg className="beam" viewBox="0 0 460 180" role="img"
                 aria-label="Crawlers departing to three competitor storefronts and returning price data.">
              <path className="wire" d="M40,90 C170,90 210,26 400,26" />
              <path className="wire" d="M40,90 C180,90 220,90 400,90" />
              <path className="wire" d="M40,90 C170,90 210,154 400,154" />
              <path className="pulse" id="p0" d="M40,90 C170,90 210,26 400,26" />
              <path className="pulse" id="p1" d="M40,90 C180,90 220,90 400,90" />
              <path className="pulse" id="p2" d="M40,90 C170,90 210,154 400,154" />
              <rect className="node" x="6" y="76" width="34" height="28" rx="3" />
              <rect className="node" x="400" y="12" width="56" height="27" rx="3" />
              <text className="nl" x="407" y="29">NORTHWIND</text>
              <rect className="node" x="400" y="76" width="56" height="27" rx="3" />
              <text className="nl" x="407" y="93">HALDEN</text>
              <rect className="node" x="400" y="140" width="56" height="27" rx="3" />
              <text className="nl" x="407" y="157">VESSEL</text>
            </svg>
            <div className="feed" id="feed" />
          </div>
        </div>
      </section>

      {/* 3 — one product, two listings */}
      <section className="wrap match" id="matchSec">
        <h2 className="x">Same chair.<br />Different name.</h2>
        <div className="arena">
          <div className="pcard" id="cardL">
            <Image src="/products/web/chair-ergomesh.jpg" alt="Ergonomic mesh task chair as listed in your own catalogue."
                   width={1040} height={780} priority={false} />
            <div className="meta">
              <h3>Task Chair, Ergonomic Mesh</h3>
              <div className="sku">TC-4471-BLK &middot; your catalogue</div>
              <div className="pz">&euro;89.00</div>
            </div>
          </div>
          <div className="lock">
            <span className="lb">Confidence</span>
            <div className="sc" id="score">0.94</div>
            <span className="lb" id="verdict">locked</span>
          </div>
          <div className="pcard" id="cardR">
            <Image src="/products/web/chair-ergomesh-rival.jpg" alt="The same chair photographed from a different angle and listed by a competitor under another name."
                   width={1040} height={780} priority={false} />
            <div className="meta">
              <h3>ErgoMesh Office Chair</h3>
              <div className="sku">NW-88213 &middot; Northwind Supply</div>
              <div className="pz lime">&euro;79.90</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 — the tape, and where one line goes */}
      <section className="wrap tick-sec" id="tickSec">
        <div className="tick-grid">
          <div className="tape"><ul id="tape" /></div>
          <div className="outs">
            <div className="out" id="out1">
              <span className="ic"><Mail size={15} color="#C6F24E" strokeWidth={2} aria-hidden /></span>
              <div><h4>nabil@brand.com</h4><p>Undercut &mdash; ErgoMesh &euro;79.90</p></div>
            </div>
            <div className="out" id="out2">
              <span className="ic"><Hash size={15} color="#C6F24E" strokeWidth={2} aria-hidden /></span>
              <div><h4>#pricing</h4><p>Northwind &minus;10.2% &middot; 03:14</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* 5 — the interface, standing up */}
      <section className="wrap rev" id="revSec">
        <h2 className="x">Wake up to the answer.</h2>
        <div className="device" id="device">
          <div className="devbar">
            <i className="dot3" /><i className="dot3" /><i className="dot3" />
            <span>app.pricevane.io</span>
          </div>
          <div className="dash">
            <div className="side">
              <span className="wm" style={{ fontSize: '10px' }}>Price<b>vane</b></span>
              <div className="nav2">
                <i className="on">Overview</i><i>Products</i><i>Competitors</i><i>Matches</i><i>Alerts</i>
              </div>
            </div>
            <div className="main">
              <div className="krow">
                <div className="k"><span className="lb">Tracked</span><div className="v" data-c="312">0</div></div>
                <div className="k"><span className="lb">Moves</span><div className="v" data-c="47">0</div></div>
                <div className="k"><span className="lb">Cheapest on</span><div className="v lime" data-c="68" data-s="%">0</div></div>
                <div className="k"><span className="lb">Alerts</span><div className="v" style={{ color: '#FF2E4C' }} data-c="6">0</div></div>
              </div>
              <svg className="chart" viewBox="0 0 600 200" preserveAspectRatio="none" role="img"
                   aria-label="Six months of price history: your price holds flat while a competitor's falls below it.">
                <line x1="0" y1="66" x2="600" y2="66" stroke="rgba(236,234,228,.06)" />
                <line x1="0" y1="133" x2="600" y2="133" stroke="rgba(236,234,228,.06)" />
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

      {/* 6 — close */}
      <section className="wrap close">
        <h2 className="x">Sleep on it.</h2>
        <div className="row">
          <button className="btn" type="button">Start free</button>
          <span className="lb">25 products &middot; nightly &middot; no card</span>
        </div>
      </section>

      <footer className="wrap">
        <span className="lb">Pricevane &mdash; a Nabil Amhaouch project</span>
      </footer>

      <LandingMotion />
    </>
  )
}
