import { ArrowRight, Bell, Check, GitCompareArrows, Lock, Radar, Sparkles, Store, Zap } from 'lucide-react'
import { LandingMotion } from '@/components/landing/LandingMotion'
import { ProductTabs } from '@/components/landing/ProductTabs'
import { Faq } from '@/components/landing/Faq'
import { SiteNav } from '@/components/landing/SiteNav'
import { Media } from '@/components/landing/Media'
import { Chips, Providers } from '@/components/landing/Chips'
import { BrandTile, BrandRow, BrandMark, DELIVERY, SOURCES, STACK } from '@/components/landing/Brands'
import { Portrait, type Face } from '@/components/landing/Avatar'
import { Mark } from '@/components/Logo'
import { getUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { isLocalAuth, getLocalUserId } from '@/lib/auth/local'

/**
 * Structure lifted from orshot.com, measured rather than eyeballed.
 *
 * The skeleton is theirs and it is a good one: a self-contained hero with a
 * tabbed product frame, a trusted-by strip, then numbered chapters -- 01, 02,
 * 03, 04 -- each separated by a single-quote testimonial band, closing with
 * stories, a live numbers band, pricing and an FAQ.
 *
 * Measured off the real page at 1440px:
 *   content column   1048px
 *   nav height       52px
 *   h1               60px / 600 / 61px / -1.5px tracking, centred
 *   section headline 40px / 500 / 46px / -0.88px tracking
 *   vertical rhythm  56 / 80 / 96px
 *   radii            pill, 24, 16, 12, 8, 6
 *
 * The words, figures, imagery and palette are Pricevane's. Their copy sells an
 * image-rendering API; it would be both an infringement and useless here.
 */

const CHAPTERS = [
  {
    n: '01', kind: 'MONITOR', id: 'ch1',
    title: 'Every rival, every night, while nobody is watching.',
    body:
      'Crawlers leave at 02:00 and are finished before breakfast. Each one carries a ' +
      'coherent identity — proxy, user agent, locale and timezone rotate together, ' +
      'because rotating the IP alone is how you get linked and blocked.',
    points: [
      ['Playwright, not HTTP scraping', 'Prices rendered by JavaScript are still prices.'],
      ['Per-domain rate limiting', 'Full-jitter backoff. We are a guest on every host.'],
      ['Every point traces to a run', 'A figure you cannot audit is a figure you cannot trust.'],
    ],
    Icon: Radar,
    chips: ['Rotating identities', 'Per-domain rate limits', 'Retry with backoff',
            'Crawl run records', 'Structured error logs', 'JSON-LD + microdata'],
    more: '+4 more',
    media: { w: 1026, h: 577, label: 'A night run, start to finish', kind: 'video' as const,
             hint: '02:00 departure through 04:48 close, 38 storefronts' },
    action: 'Watch a run',
  },
  {
    n: '02', kind: 'MATCH', id: 'ch2',
    title: 'The same chair, listed under four different names.',
    body:
      'Competitors do not use your SKUs, your titles or your photography. Matching is ' +
      'done by a model that returns a confidence and its reasoning in plain words — ' +
      'and then waits for a person.',
    points: [
      ['Confidence and a reason', 'Never a bare score you have to take on faith.'],
      ['Nothing auto-applies', 'Not at 0.94. Not at 0.99. A human confirms every match.'],
      ['Your decisions train it', 'Confirmations and rejections both come back as examples.'],
    ],
    Icon: GitCompareArrows,
    chips: ['Confidence + reason', 'Human confirmation', 'Few-shot feedback',
            'Rejections stored too', 'Structured output', 'Review floor at 0.55'],
    more: '+3 more',
    media: { w: 467, h: 309, label: 'Match review queue', kind: 'image' as const,
             hint: 'Two listings, a confidence, and the model\u2019s reasoning' },
    action: 'See how matching works',
  },
  {
    n: '03', kind: 'ALERT', id: 'ch3',
    title: 'Only the crossings. Never the noise.',
    body:
      'An undercut alert fires on the crossing, not on the state — the moment a rival ' +
      'goes under you, once, and not again every night afterwards. Stock alerts fire on ' +
      'the transition for the same reason.',
    points: [
      ['Email and Slack', 'Delivered within seconds of the crossing being written.'],
      ['Deduplicated by movement', 'A genuine new move gets through; a re-observation does not.'],
      ['Thresholds you set', 'Undercut at 1%, drop at 5%, rise at 8% — or your own numbers.'],
    ],
    Icon: Bell,
    chips: ['Email', 'Slack', 'Undercut', 'Price drop', 'Price rise',
            'Back in stock', 'Out of stock', 'Discontinued'],
    more: '+2 more',
    media: { w: 516, h: 369, label: 'An alert, delivered', kind: 'image' as const,
             hint: 'The crossing, the movement, and the minute it happened' },
    action: 'See alert rules',
  },
  {
    n: '04', kind: 'INFRASTRUCTURE', id: 'ch4',
    title: 'The database refuses. Not the code.',
    body:
      'Tenant isolation is a row-level security policy on every table, not a WHERE clause ' +
      'somebody has to remember. Application filtering fails open — one missing filter ' +
      'leaks a table and the tests still pass. This fails closed.',
    points: [
      ['Row-level security, forced', 'Applied to the table owner too, so migrations obey it.'],
      ['Proven adversarially', 'A test crafts a query as org A and still gets zero rows.'],
      ['Idempotent billing', 'An event ledger means a replayed webhook cannot double-apply.'],
    ],
    Icon: Lock,
    chips: ['Postgres RLS', 'FORCE on every table', 'Stripe event ledger',
            'Out-of-order guard', 'Plan limits in the database', 'Audit log'],
    more: '+5 more',
    media: { w: 1026, h: 577, label: 'The isolation test running', kind: 'video' as const,
             hint: 'A crafted cross-tenant query returning zero rows' },
    action: 'Read the architecture',
  },
] as const

const QUOTES = [
  {
    text:
      'We used to find out we had been undercut when a customer told us. Now it is in ' +
      'my inbox before I am awake, with the exact minute it happened.',
    who: 'Marta R.', role: 'Head of Trading, Lumen Home', init: 'MR',
  },
  {
    text:
      'Two people, half a day, every fortnight, copying prices into a spreadsheet that ' +
      'was already wrong by the time we saved it. That job does not exist any more.',
    who: 'Joris D.', role: 'Founder, Fjorda', init: 'JD',
  },
  {
    text:
      'The matching is the part I trusted last and rely on most. It has never once ' +
      'merged two products behind my back.',
    who: 'Amira K.', role: 'Operations, Sable + Stone', init: 'AK',
  },
] as const

/**
 * Is there a session? Only to decide what the header offers -- never to gate
 * anything, which is the database's job. A failure here must degrade to the
 * signed-out header rather than to an error page, so it is wrapped.
 */
async function hasSession(): Promise<boolean> {
  try {
    if (isLocalAuth()) return Boolean(await getLocalUserId())
    if (!isSupabaseConfigured()) return false
    return Boolean(await getUser())
  } catch { return false }
}

/**
 * Invented customers, and the page says so under the fold.
 *
 * `size` drives the masonry: two cards get more room because their claim is
 * the strongest, which is the difference between a testimonial wall you skim
 * and one you scroll past. `tag` colour-codes each quotation by the capability
 * it is about. `hue` picks the avatar colour.
 *
 * The avatars are monograms, not photographs. Generating photoreal faces to
 * attach to quotations nobody said is the one thing a fake testimonial must
 * not do -- a drawn monogram is honestly synthetic, and it survives being
 * looked at closely. Swap in real portraits here if there are ever real
 * customers to photograph.
 */
const STORIES: {
  q: string; who: string; co: string; initials: string; hue: number; face: Face
  size?: 'lg' | 'wide'
  tag: [typeof Bell, string, string]
}[] = [
  { q: 'Caught a price war on day two, not week three.', who: 'Ben T.', co: 'Lumen Home',
    initials: 'BT', hue: 1, size: 'lg',
    face: { skin: '#D9A377', hair: '#2A1F1A', shirt: '#2E3A42', cut: 'short', beard: 'stubble' }, tag: [Bell, 'alert', 'Alerts'] },
  { q: 'We reprice twice a week now instead of twice a month.', who: 'Ivan K.', co: 'Kestrel & Co',
    initials: 'IK', hue: 2,
    face: { skin: '#F0C9A4', hair: '#8A6A4A', shirt: '#3A3550', cut: 'wave', glasses: true }, tag: [Zap, 'speed', 'Cadence'] },
  { q: 'The stockout alert alone paid for the year.', who: 'Mihai C.', co: 'Fjorda',
    initials: 'MC', hue: 3,
    face: { skin: '#B87A4F', hair: '#1C1614', shirt: '#264238', cut: 'crop', beard: 'full' }, tag: [Store, 'stock', 'Stock'] },
  { q: 'Matching found 40 listings we did not know existed.', who: 'Nic C.', co: 'Ardent Tools',
    initials: 'NC', hue: 4, size: 'wide',
    face: { skin: '#8A5433', hair: '#1C1614', shirt: '#43303C', cut: 'curls' }, tag: [GitCompareArrows, 'match', 'Matching'] },
  { q: 'One dashboard for four brands, none of them mixed up.', who: 'Max M.', co: 'Sable + Stone',
    initials: 'MM', hue: 5,
    face: { skin: '#E8B48C', hair: '#3A3A3E', shirt: '#3B3324', cut: 'receding', beard: 'goatee' }, tag: [Lock, 'iso', 'Isolation'] },
  { q: 'I stopped keeping a competitor spreadsheet entirely.', who: 'Francesca O.', co: 'Vellum',
    initials: 'FO', hue: 6,
    face: { skin: '#5E3A22', hair: '#1C1614', shirt: '#22333F', cut: 'tied', beard: 'stubble' }, tag: [Radar, 'crawl', 'Coverage'] },
  { q: 'We were the only shop in stock for eleven days.', who: 'Thomas S.', co: 'Noor Atelier',
    initials: 'TS', hue: 3,
    face: { skin: '#F0C9A4', hair: '#4A342A', shirt: '#333A2A', cut: 'short', glasses: true }, tag: [Store, 'stock', 'Stock'] },
  { q: 'Set it up on a Friday. It found something that night.', who: 'David F.', co: 'Bastion',
    initials: 'DF', hue: 2,
    face: { skin: '#D9A377', hair: '#6B4A32', shirt: '#2B2F3E', cut: 'crop', beard: 'goatee' }, tag: [Radar, 'crawl', 'Coverage'] },
]

/** The three plans. `hue` colours the tier icon; `lead` labels its list. */
const TIERS: {
  n: string; p: string; s: string; who: string; cta: string; on: boolean
  hue: string; lead: string; Icon: typeof Bell; f: [string, boolean][]
}[] = [
  { n: 'Free', p: '€0', s: 'forever', who: 'One shop, finding its feet',
    cta: 'Start free', on: false, hue: 'sky', lead: 'Includes', Icon: Store,
    f: [['25 products', false], ['Weekly crawls', false], ['1 storefront', false],
        ['Email alerts', false]] },
  { n: 'Studio', p: '€49', s: 'per month', who: 'A catalogue with real rivals',
    cta: 'Start free trial', on: true, hue: 'lime', lead: 'Everything in Free, plus', Icon: Zap,
    f: [['350 products', true], ['Nightly crawls', true], ['10 storefronts', false],
        ['Email + Slack', false], ['LLM matching', true]] },
  { n: 'Scale', p: '€149', s: 'per month', who: 'Several brands, one team',
    cta: 'Start free trial', on: false, hue: 'violet', lead: 'Everything in Studio, plus', Icon: Radar,
    f: [['2,000 products', true], ['Twice daily', true], ['Unlimited storefronts', false],
        ['Priority crawl queue', false], ['API access', true]] },
]

/** What actually differs, side by side. */
const COMPARE: [string, typeof Bell, string, string, string][] = [
  ['Products watched', Store, '25', '350', '2,000'],
  ['Crawl frequency', Radar, 'Weekly', 'Nightly', 'Twice daily'],
  ['Storefronts', GitCompareArrows, '1', '10', 'Unlimited'],
  ['Alert delivery', Bell, 'Email', 'Email + Slack', 'Email + Slack'],
  ['Model matching', Zap, '—', 'Included', 'Included'],
  ['API access', Lock, '—', '—', 'Included'],
]

/** The footer's elsewhere row. LinkedIn is absent because its mark has been
 *  withdrawn from the icon set, and drawing an approximation of somebody's
 *  logo is worse than not showing it. */
const SOCIAL = [
  { id: 'github', name: 'GitHub', hex: '#E8E6E1' },
  { id: 'x', name: 'X', hex: '#E8E6E1' },
  { id: 'rss', name: 'RSS', hex: '#FFA500' },
]

export default async function Home() {
  const signedIn = await hasSession()
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <div id="rail"><div id="railfill" /></div>

      <SiteNav signedIn={signedIn} />

      <main id="main">

        {/* ── HERO ─────────────────────────────────────────────── */}
        <header className="hero">
          {/* The two prices. Yours holds its level; theirs falls through it at
              x=860, which is the whole product in one gesture. The rival line
              is a gradient rather than a flat stroke -- neutral while it is
              above you, alert-red once it is under -- and the crossing carries
              a marker, because the moment is the point and it was previously
              just an unremarked intersection of two grey lines. */}
          <svg id="duel" viewBox="0 0 1440 800" preserveAspectRatio="none" role="img"
               aria-label="Your price holds flat while a competitor's price falls and crosses beneath it at 03:14.">
            <defs>
              <linearGradient id="gTheirs" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8A9195" stopOpacity=".35" />
                <stop offset="46%" stopColor="#8A9195" stopOpacity=".9" />
                <stop offset="62%" stopColor="#FF2E4C" stopOpacity=".95" />
                <stop offset="100%" stopColor="#FF2E4C" stopOpacity=".8" />
              </linearGradient>
              <linearGradient id="gMine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#C6F24E" stopOpacity=".25" />
                <stop offset="30%" stopColor="#C6F24E" stopOpacity="1" />
                <stop offset="100%" stopColor="#C6F24E" stopOpacity="1" />
              </linearGradient>
            </defs>
            <path id="mine" d="M0,392 L180,388 L360,396 L540,386 L720,392 L900,389 L1080,394 L1260,390 L1440,388" />
            <path id="theirs" d="M0,250 L180,272 L360,222 L540,300 L720,330 L860,392 L960,470 L1130,556 L1290,570 L1440,562" />
          </svg>
          {/* The crossing. `.xpt` has been in the stylesheet all along with no
              element to attach to, so the one moment the graphic is about has
              never actually been marked. */}
          <span className="xpt" id="xpt" aria-hidden="true" />

          <div className="hwrap">
            <span className="pill" id="hpill">
              <b>NEW</b> Nightly crawls with rotating identities
              <ArrowRight size={13} aria-hidden />
            </span>

            <h1 className="h1" id="h1">
              <span className="ln"><i>Know the price</i></span>
              <span className="ln"><i>before your customer does.</i></span>
            </h1>

            <p className="hsub" id="hsub">
              Pricevane watches every competitor listing overnight and tells you the
              moment one goes under you — with the product matched, the movement
              measured, and the minute it happened.
            </p>

            <div className="hcta" id="hcta">
              <button className="btn big" type="button">
                Start free <ArrowRight size={15} aria-hidden />
              </button>
              <a className="btn ghost big provbtn" href="/architecture">
                <Providers compact />
                Bring your own model
              </a>
            </div>
            <p className="hnote" id="hnote">25 products · nightly · no card</p>
          </div>

          <div className="hframe" id="hframe"><ProductTabs /></div>
        </header>

        {/* ── TRUSTED BY ───────────────────────────────────────── */}
        <section className="band trust" id="proof">
          <p className="eyebrow">Trusted by retail and brand teams across Europe</p>
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

        {/* ── CHAPTERS, alternating with quote bands ───────────── */}
        {CHAPTERS.map((c, i) => (
          <div key={c.n}>
            <section className="band chapter" id={c.id} data-ch={i}>
              <div className="chead">
                <span className="cnum">{c.n}</span>
                <span className="ckind">{c.kind}</span>
              </div>
              <h2 className="h2">{c.title}</h2>
              <p className="lede">{c.body}</p>

              <div className="cgrid">
                {c.points.map(([t, d]) => (
                  <div className="cpoint" key={t}>
                    <span className="cico"><Check size={13} aria-hidden /></span>
                    <div>
                      <h3>{t}</h3>
                      <p>{d}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Chips items={c.chips} more={c.more} />

              <div className="cmedia">
                <Media w={c.media.w} h={c.media.h} label={c.media.label}
                       hint={c.media.hint} kind={c.media.kind} />
              </div>

              <a className="clink" href="/architecture">
                {c.action} <ArrowRight size={13} aria-hidden />
              </a>

              <div className="cvis" aria-hidden="true">
                <c.Icon size={20} />
                <span className="cvis-t">{c.kind}</span>
              </div>
            </section>

            {QUOTES[i] && (
              <section className="band quote">
                <span className="qmark" aria-hidden="true">&ldquo;</span>
                <blockquote>{QUOTES[i].text}</blockquote>
                <figcaption className="qwho">
                  <i>{QUOTES[i].init}</i>
                  <span><b>{QUOTES[i].who}</b>{QUOTES[i].role}</span>
                </figcaption>
              </section>
            )}
          </div>
        ))}


        {/* ── CUSTOMER STORIES ─────────────────────────────────── */}
        <section className="band stories" id="storiesSec">
          <p className="eyebrow">Customer stories</p>
          <h2 className="h2">How teams stopped losing the morning.</h2>
          <p className="lede">
            Eight invented companies, because this is a portfolio piece and saying so
            is better than implying otherwise. What each of them describes is a thing
            the running product actually does.
          </p>
          {/* A uniform grid of eight identical cards reads as a wall of text and
              tells you nothing about which quotation matters. The grid is now
              masonry-ish: two cards are given double width and a larger type
              size because they carry the strongest claims, and the tag on each
              card is coloured by the capability it is about, so the section can
              be skimmed by colour before it is read. */}
          <div className="sgrid">
            {STORIES.map(s => {
              const [TagIcon, tagKind, tagLabel] = s.tag
              return (
              <figure className={`scard${s.size === 'lg' ? ' lg' : ''}${s.size === 'wide' ? ' wide' : ''}`}
                      key={s.who}>
                <span className={`stag t-${tagKind}`}>
                  <TagIcon size={12} aria-hidden />{tagLabel}
                </span>
                <p>&ldquo;{s.q}&rdquo;</p>
                <figcaption className="swho">
                  <span className={`av av-${s.hue}`}><Portrait f={s.face} size={40} /></span>
                  <span><b>{s.who}</b>{s.co}</span>
                </figcaption>
              </figure>
            )})}
          </div>
        </section>

        {/* ── WHERE IT PLUGS IN ────────────────────────────────── */}
        <section className="band integ" id="integSec">
          <p className="eyebrow">Connections</p>
          <h2 className="h2">Where the alert lands.</h2>
          <p className="lede">
            Three delivery channels are built and running. The catalogue sources below
            are not — they are named here because the shape of the work is decided, and
            a logo grid that does not say which is which is a claim, not a roadmap.
          </p>

          <div className="bgrid live-set">
            {DELIVERY.map(b => <BrandTile b={b} key={b.id} />)}
          </div>

          <p className="bsub">Catalogue sources — planned, none of them wired</p>
          <div className="bgrid">
            {SOURCES.map(b => <BrandTile b={b} key={b.id} />)}
          </div>
        </section>

        {/* ── THE NUMBERS ──────────────────────────────────────── */}
        <section className="band nums" id="numsSec">
          <p className="eyebrow">The numbers</p>
          <h2 className="h2">Read overnight. Every single night.</h2>
          {/* The final figure is the markup, not the animation's endpoint.
              These used to render a literal 0 and rely on GSAP to fill them in,
              which meant anyone on reduced motion -- where the choreography
              returns before it registers a single trigger -- was told we had
              captured zero snapshots across zero storefronts. The counter now
              sets the value to 0 and counts back up to what is already there,
              so with no JavaScript, a failed bundle or motion turned off, the
              page still states the truth. */}
          <div className="ngrid">
            <div className="nbox"><b data-c="7612">7,612</b><span>Snapshots last run</span></div>
            <div className="nbox"><b data-c="312">312</b><span>Listings tracked</span></div>
            <div className="nbox"><b data-c="38">38</b><span>Storefronts watched</span></div>
            <div className="nbox"><b data-c="4" data-s="h 48m">4h 48m</b><span>From first crawl to last</span></div>
          </div>
        </section>

        {/* ── PRICING ──────────────────────────────────────────── */}
        <section className="band pricing" id="pricingSec">
          <p className="eyebrow">Pricing</p>
          <h2 className="h2">Priced on what you track, not on seats.</h2>
          <p className="lede center">
            Invite the whole team on any plan. You pay for products watched and how
            often we check them.
          </p>

          <div className="pgrid">
            {TIERS.map(tier => (
              <div className={`ptier${tier.on ? ' on' : ''}`} key={tier.n}>
                {tier.on && <span className="pbadge"><Sparkles size={11} aria-hidden />Most chosen</span>}
                <span className={`pico p-${tier.hue}`}><tier.Icon size={19} aria-hidden /></span>
                <h3>{tier.n}</h3>
                <p className="ptag">{tier.who}</p>
                <div className="pprice"><b>{tier.p}</b><span>{tier.s}</span></div>
                <button className={`btn${tier.on ? '' : ' ghost'} full`} type="button">{tier.cta}</button>
                <span className="plabel">{tier.lead}</span>
                <ul>{tier.f.map(([f, strong]) => (
                  <li key={f} className={strong ? 'hi' : undefined}>
                    <Check size={13} aria-hidden />{f}
                  </li>
                ))}</ul>
              </div>
            ))}
          </div>

          {/* The three numbers that actually differ between plans, pulled out
              of the feature lists where they were buried among ticks. This is
              the comparison anyone is really making. */}
          <div className="pcompare" role="table" aria-label="Plans compared">
            <div className="pcrow pchead" role="row">
              <span role="columnheader">What changes</span>
              <span role="columnheader">Free</span>
              <span role="columnheader">Studio</span>
              <span role="columnheader">Scale</span>
            </div>
            {COMPARE.map(([label, Icon, a, b, c]) => (
              <div className="pcrow" role="row" key={label as string}>
                <span role="cell"><Icon size={14} aria-hidden />{label as string}</span>
                <span role="cell">{a as string}</span>
                <span role="cell" className="mid">{b as string}</span>
                <span role="cell">{c as string}</span>
              </div>
            ))}
          </div>

          <p className="pfoot">
            <Zap size={13} aria-hidden /> Stripe test mode. Card <code>4242 4242 4242 4242</code>,
            any future date, any CVC.
          </p>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section className="band faq" id="faqSec">
          <p className="eyebrow">Questions</p>
          <h2 className="h2">The usual ones.</h2>
          <Faq />
        </section>

        {/* ── CLOSE ────────────────────────────────────────────── */}
        <section className="band close2">
          <Store size={22} aria-hidden />
          <h2 className="h2 big">Sleep on it.</h2>
          <p className="lede center">
            The crawls run at two in the morning either way. You may as well read the
            answer over coffee.
          </p>
          <div className="hcta center">
            <button className="btn big" type="button">Start free <ArrowRight size={15} aria-hidden /></button>
          </div>
        </section>
      </main>

      {/* The reference footer is 1035px tall and carries 70 links across
          columns. Ours was two lines. Every link here resolves -- to a real
          route or to a section on this page. A footer stuffed with dead
          anchors is worse than a short one, so the columns are sized to what
          actually exists. */}
      <footer className="foot">
        <div className="footin">
          <div className="footbrand">
            <span className="wm"><Mark size={24} /><span>Price<b>vane</b></span></span>
            <p>Competitor prices, checked overnight.<br />Read the answer over coffee.</p>
            {/* These were four bare grey squares: `.social i` had a background
                and no glyph, so the row read as a rendering failure. */}
            <div className="social" aria-label="Elsewhere">
              {SOCIAL.map(b => (
                <a key={b.id} href="/architecture" aria-label={b.name} title={b.name}>
                  <BrandMark b={b} size={16} />
                </a>
              ))}
            </div>
            <div className="builtwith">
              <span className="lb">Built with</span>
              <BrandRow items={STACK} label="Technology used" />
            </div>
          </div>

          <div className="footcols">
            {[
              ['Product', [
                ['Monitoring', '#ch1'], ['Matching', '#ch2'], ['Alerts', '#ch3'],
                ['Isolation', '#ch4'], ['Pricing', '#pricingSec'], ['Live demo', '/demo'],
              ]],
              ['Engineering', [
                ['Architecture', '/architecture'], ['Row-level security', '/architecture'],
                ['Billing ledger', '/architecture'], ['Crawler design', '/architecture'],
                ['Matching provider', '/architecture'],
              ]],
              ['Company', [
                ['Customer stories', '#storiesSec'], ['The numbers', '#numsSec'],
                ['Questions', '#faqSec'], ['Sign in', '/sign-in'],
              ]],
            ].map(([title, links]) => (
              <nav className="footcol" key={title as string} aria-label={title as string}>
                <h3>{title as string}</h3>
                <ul>
                  {(links as [string, string][]).map(([t, href]) => (
                    <li key={t}><a href={href}>{t}</a></li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="footnote">
          <p className="fict">
            A portfolio project by Nabil Amhaouch. Every company, customer, quotation
            and figure on this page is invented, and the storefronts the crawlers visit
            are three fictional shops built for the purpose &mdash; no real retailer is
            crawled. The architecture, the isolation tests and the billing ledger are
            real and are documented on the{' '}
            <a href="/architecture">architecture page</a>.
          </p>
          <p className="footlegal">
            <span>&copy; 2026 Pricevane</span>
            <span>Stripe test mode only &mdash; no live keys</span>
            <span>Built with Next.js, Postgres and Playwright</span>
          </p>
        </div>
      </footer>

      <LandingMotion />
    </>
  )
}
