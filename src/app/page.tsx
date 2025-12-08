import Image from 'next/image'
import { Hash, Mail } from 'lucide-react'
import { LandingMotion } from '@/components/landing/LandingMotion'
import { ProductTabs } from '@/components/landing/ProductTabs'

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
      <a className="skip" href="#main">Skip to content</a>
      <div id="rail"><div id="railfill" /></div>

      <nav>
        <span className="wm">Price<b>vane</b></span>
        <button className="btn" type="button">Start free</button>
      </nav>

      {/* 1 — the duel */}
      <main id="main">
      <header className="hero">
        <svg id="duel" viewBox="0 0 1440 800" preserveAspectRatio="none" role="img"
             aria-label="Your price holds flat while a competitor's price falls and crosses beneath it at 03:14.">
          <path id="mine" d="M0,392 L180,388 L360,396 L540,386 L720,392 L900,389 L1080,394 L1260,390 L1440,388" />
          <path id="theirs" d="M0,250 L180,272 L360,222 L540,300 L720,330 L860,392 L960,470 L1130,556 L1290,570 L1440,562" />
        </svg>

        {/* The marker lives outside the SVG on purpose. The duel uses
            preserveAspectRatio="none" so the price lines span any viewport,
            which stretches every shape inside it too — at 430px the crossing
            circle rendered as a tall ellipse. In HTML it stays round at every
            width, positioned at the same point: 882/1440 by 391/800. */}
        <div className="xpt" id="xpt" aria-hidden="true" />

        <div className="acard" id="acard">
          <span className="lb">Undercut</span>
          <h3>Northwind dropped ErgoMesh to &euro;79.90</h3>
          <p className="m"><b>&minus;10.2%</b> &nbsp;&middot;&nbsp; &euro;9.10 under you &nbsp;&middot;&nbsp; 03:14</p>
        </div>

        <div className="axis" id="axis">
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

      {/* Social proof, inline. Supercut runs its logos as a sentence in the
          hero rather than a strip below it, which reads as a fact about the
          product instead of a badge wall. */}
      <section className="proof" id="proof">
        <p className="proofline">
          Watching <b>1,240 listings</b> across <b>38 storefronts</b> for
        </p>
        <div className="wall" aria-label="Customers">
          <span>LUMEN HOME</span>
          <span>KESTREL &amp; CO</span>
          <span>FJORDA</span>
          <span>ARDENT TOOLS</span>
          <span>SABLE + STONE</span>
          <span>VELLUM</span>
          <span>NOOR ATELIER</span>
          <span>BASTION</span>
        </div>
      </section>

      {/* The Webhound device: two cards, same job, side by side. It is the
          most persuasive block on any reference page and it needs nobody's
          permission -- no logos, no quotes, no claims about anyone else. */}
      <section className="wrap vs" id="vsSec">
        <h2 className="x">One of these<br />runs at 3am.</h2>
        <div className="vsgrid">
          <div className="vscard" id="vsA">
            <div className="vshead">
              <span className="dot" />
              <b>By hand</b>
              <span className="tag">every other Monday</span>
            </div>
            <ul className="vslog">
              <li><i>09:40</i> Open 12 competitor tabs</li>
              <li><i>09:58</i> Copy 40 prices into a sheet</li>
              <li><i>10:24</i> Realise two SKUs were renamed</li>
              <li><i>10:31</i> Give up on the other 26 storefronts</li>
              <li className="dim"><i>&nbsp;</i>&hellip;</li>
            </ul>
            <div className="vsfoot">
              <span><b>40</b> of 312 checked</span>
              <span className="bad">11 days stale</span>
            </div>
          </div>

          <div className="vscard on" id="vsB">
            <div className="vshead">
              <span className="dot live" />
              <b>Pricevane</b>
              <span className="tag lime">every night</span>
            </div>
            <ul className="vslog">
              <li><i>02:00</i> 38 storefronts queued</li>
              <li><i>03:12</i> Northwind cut ErgoMesh 10.2%</li>
              <li><i>03:14</i> Crossing detected &mdash; alert written</li>
              <li><i>03:14</i> Email + Slack delivered</li>
              <li><i>04:48</i> Run closed &middot; 7,612 snapshots</li>
            </ul>
            <div className="vsfoot">
              <span><b>312</b> of 312 checked</span>
              <span className="good">4 hours ago</span>
            </div>
          </div>
        </div>
        <p className="vscap">One you have to remember. The other you find waiting.</p>
      </section>

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
              <rect className="node" x="392" y="12" width="66" height="27" rx="3" />
              <text className="nl" x="399" y="29">NORTHWIND</text>
              <rect className="node" x="392" y="76" width="66" height="27" rx="3" />
              <text className="nl" x="399" y="93">HALDEN</text>
              <rect className="node" x="392" y="140" width="66" height="27" rx="3" />
              <text className="nl" x="399" y="157">VESSEL</text>
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

      {/* 5 — the interface, standing up. One frame, four panes. */}
      <section className="wrap rev" id="revSec">
        <h2 className="x">Wake up to the answer.</h2>
        <div className="device" id="device">
          <ProductTabs />
        </div>
      </section>

      {/* 6 — the reviews, as evidence rather than praise. Each card leads with
          the number the product moved, because "great tool!" is worth nothing
          and "we stopped being undercut for eleven days at a time" is worth
          reading. */}
      <section className="wrap says" id="saysSec">
        <h2 className="x">What it<br />changed.</h2>
        <div className="cards">
          <figure className="rcard" id="rc0">
            <div className="rnum">11 &rarr; 0</div>
            <span className="lb">Days of stale pricing</span>
            <blockquote>
              We used to find out we&rsquo;d been undercut when a customer told us.
              Now it&rsquo;s in my inbox before I&rsquo;m awake.
            </blockquote>
            <figcaption><i>MR</i><span><b>Marta R.</b>Head of Trading, Lumen Home</span></figcaption>
          </figure>

          <figure className="rcard" id="rc1">
            <div className="rnum">4<em>h</em></div>
            <span className="lb">Back every Monday morning</span>
            <blockquote>
              Two people, half a day, every fortnight, copying prices into a
              spreadsheet that was wrong by the time we saved it.
            </blockquote>
            <figcaption><i>JD</i><span><b>Joris D.</b>Founder, Fjorda</span></figcaption>
          </figure>

          <figure className="rcard" id="rc2">
            <div className="rnum">0.94</div>
            <span className="lb">And it still asks first</span>
            <blockquote>
              The matching is the part I trusted last and rely on most. It has
              never once merged two products behind my back.
            </blockquote>
            <figcaption><i>AK</i><span><b>Amira K.</b>Ops, Sable + Stone</span></figcaption>
          </figure>
        </div>
      </section>

      {/* 7 — close */}
      <section className="wrap close">
        <h2 className="x">Sleep on it.</h2>
        <div className="row">
          <button className="btn" type="button">Start free</button>
          <span className="lb">25 products &middot; nightly &middot; no card</span>
        </div>
      </section>

      </main>

      <footer className="wrap">
        <span className="lb">Pricevane &mdash; a Nabil Amhaouch project</span>
        {/* Said plainly, because a portfolio piece that quietly implies real
            customers is the one thing that would undo the point of building it
            carefully. The engineering is real; the companies are not. */}
        <p className="fict">
          A portfolio project. Every company, customer, quotation and figure on
          this page is invented, and the storefronts the crawlers visit are three
          fictional shops built for the purpose &mdash; no real retailer is
          crawled. The architecture, the isolation tests and the billing ledger
          are real and are documented on the{' '}
          <a href="/architecture">architecture page</a>.
        </p>
      </footer>

      <LandingMotion />
    </>
  )
}
