import type { Metadata } from 'next'
import Link from 'next/link'
import './arch.css'

export const metadata: Metadata = {
  title: 'How Pricevane is built',
  description:
    'Three engineering decisions behind Pricevane: why tenant isolation lives in Postgres, how Stripe webhooks are made idempotent, and how crawler blocks are handled.',
}

export default function Architecture() {
  return (
    <article className="doc">
      <header className="top">
        <Link href="/" className="wm" style={{ textDecoration: 'none' }}>Price<b>vane</b></Link>
        <span className="lb">Written for a technical reader</span>
      </header>

      <h1>Three decisions worth explaining.</h1>
      <p className="standfirst">
        Most of this product is ordinary. Three parts are not, and they are the parts that decide
        whether it survives contact with real customers: where tenant isolation lives, what happens
        when Stripe delivers the same event twice, and what a crawler does when it gets blocked.
      </p>

      {/* ---------------------------------------------------------------- */}
      <section id="isolation">
        <h2><span className="num">01 — Isolation</span>The database refuses, not the code.</h2>

        <p>
          Every tenant-scoped table carries an <code>organization_id</code> and a row-level security
          policy. There is no path — ORM, raw SQL, crafted filter, forgotten <code>WHERE</code> —
          that returns one customer&rsquo;s rows to another.
        </p>

        <div className="pull">
          <p>
            Application-layer filtering was rejected because it fails <em>open</em>. A missing
            <code>.eq(&lsquo;organization_id&rsquo;, …)</code> in one handler leaks a whole table and
            nothing complains — the tests still pass, because they exercise the handler that has the
            filter. RLS fails <em>closed</em>: forget it and you get zero rows.
          </p>
        </div>

        <p>
          The failure mode of a security mechanism should be silence, not disclosure. That is the
          entire argument.
        </p>

        <figure>
          <svg className="diagram" viewBox="0 0 760 300" role="img"
               aria-label="Two request paths. Both reach Postgres; the row-level security policy filters each one to its own organization, so a crafted query from organization A returns zero rows from organization B.">
            <text x="20" y="26" fill="#8A9195" fontFamily="var(--fm)" fontSize="10" letterSpacing="1.6">REQUEST</text>
            <text x="250" y="26" fill="#8A9195" fontFamily="var(--fm)" fontSize="10" letterSpacing="1.6">POSTGRES</text>
            <text x="600" y="26" fill="#8A9195" fontFamily="var(--fm)" fontSize="10" letterSpacing="1.6">RESULT</text>

            <rect x="20" y="52" width="180" height="52" rx="4" fill="#191C1E" stroke="rgba(236,234,228,.18)"/>
            <text x="34" y="74" fill="#ECEAE4" fontFamily="var(--fm)" fontSize="11">user in org A</text>
            <text x="34" y="91" fill="#4E5559" fontFamily="var(--fm)" fontSize="10">select * from products</text>

            <rect x="20" y="150" width="180" height="52" rx="4" fill="#191C1E" stroke="rgba(255,46,76,.45)"/>
            <text x="34" y="172" fill="#FF2E4C" fontFamily="var(--fm)" fontSize="11">same user, crafted</text>
            <text x="34" y="189" fill="#4E5559" fontFamily="var(--fm)" fontSize="10">…where org_id = B</text>

            <path d="M200,78 L250,78" stroke="rgba(236,234,228,.25)" strokeWidth="1"/>
            <path d="M200,176 L250,176" stroke="rgba(255,46,76,.4)" strokeWidth="1"/>

            <rect x="250" y="52" width="230" height="150" rx="4" fill="#0F1112" stroke="rgba(198,242,78,.4)"/>
            <text x="266" y="76" fill="#C6F24E" fontFamily="var(--fm)" fontSize="10.5">RLS POLICY</text>
            <text x="266" y="98" fill="#8A9195" fontFamily="var(--fm)" fontSize="10">using (</text>
            <text x="276" y="114" fill="#ECEAE4" fontFamily="var(--fm)" fontSize="10">app.is_member(org_id)</text>
            <text x="266" y="130" fill="#8A9195" fontFamily="var(--fm)" fontSize="10">)</text>
            <text x="266" y="156" fill="#8A9195" fontFamily="var(--fm)" fontSize="10">with check (</text>
            <text x="276" y="172" fill="#ECEAE4" fontFamily="var(--fm)" fontSize="10">app.is_member(org_id)</text>
            <text x="266" y="188" fill="#8A9195" fontFamily="var(--fm)" fontSize="10">)</text>

            <path d="M480,78 L560,78" stroke="rgba(198,242,78,.5)" strokeWidth="1"/>
            <path d="M480,176 L560,176" stroke="rgba(255,46,76,.4)" strokeWidth="1"/>

            <rect x="560" y="52" width="180" height="52" rx="4" fill="#191C1E" stroke="rgba(198,242,78,.35)"/>
            <text x="574" y="83" fill="#C6F24E" fontFamily="var(--fm)" fontSize="11">org A rows only</text>

            <rect x="560" y="150" width="180" height="52" rx="4" fill="#191C1E" stroke="rgba(236,234,228,.18)"/>
            <text x="574" y="181" fill="#ECEAE4" fontFamily="var(--fm)" fontSize="11">0 rows</text>

            <text x="250" y="240" fill="#4E5559" fontFamily="var(--fm)" fontSize="10">
              USING filters what you can see · WITH CHECK constrains what you can write
            </text>
            <text x="250" y="258" fill="#4E5559" fontFamily="var(--fm)" fontSize="10">
              FORCE applies it to the table owner too — migrations run as the owner
            </text>
          </svg>
          <figcaption>Both paths reach the database. Only one comes back with rows.</figcaption>
        </figure>

        <h3>The three details that make it hold</h3>
        <p>
          <strong>FORCE, not just ENABLE.</strong> <code>ENABLE</code> exempts the table owner, and
          migrations run as the owner. <strong>WITH CHECK on every write policy.</strong> With
          <code>USING</code> alone, a member can <code>UPDATE</code> their own row and set
          <code>organization_id</code> to another tenant&rsquo;s — moving data across the boundary
          instead of reading across it. <strong>Membership read through a SECURITY DEFINER function
          with a pinned <code>search_path</code>.</strong> A policy on <code>memberships</code> that
          queries <code>memberships</code> recurses forever; the pinned path stops anyone shadowing
          the table from an earlier schema.
        </p>

        <p>
          None of that is worth anything unstated, so there are <strong>17 tests</strong> that open a
          raw Postgres connection, become the <code>authenticated</code> role, set the same JWT
          claims PostgREST sets from a verified token, and attack the database directly.
        </p>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section id="webhooks">
        <h2><span className="num">02 — Billing</span>Stripe will send it twice.</h2>

        <p>
          Stripe guarantees <strong>at-least-once</strong> delivery. The same event arrives again on
          timeout, on a 5xx, and on its own retry schedule. A replayed <code>invoice.paid</code>
          grants a second month. A replayed <code>subscription.deleted</code> downgrades a customer
          who has just resubscribed and paid.
        </p>

        <p>
          The ledger&rsquo;s primary key <em>is</em> the Stripe event id, and the event is claimed in
          the same transaction as the state change it causes. Applying an event and recording that it
          was applied commit or roll back together.
        </p>

        <pre><code>{`insert into stripe_events (id, type, payload, attempts)
values ($1, $2, $3, 1)
on conflict (id) do update
  set attempts = stripe_events.attempts + 1, error = null
`}<b>{`where stripe_events.processed_at is null`}</b>{`
returning id`}</code></pre>

        <div className="pull">
          <p>
            That <code>where</code> is the subtle half, and I got it wrong first. A plain
            <code>INSERT</code> looks correct until you notice the failure path records the error
            under the same event id — so the row survives a failure, the next delivery collides, and
            the event is called a duplicate and <em>never applied</em>. One transient blip and that
            customer&rsquo;s upgrade is lost permanently. The replay test caught it.
          </p>
        </div>

        <p>
          Conflicting on an <strong>unprocessed</strong> row means a previous attempt failed, so we
          take the claim and retry. Conflicting on a <strong>processed</strong> row updates nothing
          and returns nothing — and that is the real duplicate.
        </p>

        <h3>Two more things the happy path misses</h3>
        <p>
          <strong>Order is not guaranteed.</strong> Stripe promises delivery, not sequence. An update
          created at 10:00 can arrive after the one created at 10:05, rolling the tier backwards.
          Every subscription write compares <code>event.created</code> against a
          <code>last_event_at</code> watermark and drops anything staler — while still recording it
          as seen.
        </p>
        <p>
          <strong>A failed invoice does not downgrade.</strong> Stripe retries for days. Cutting
          service off on a temporary decline is how you lose a paying customer to a bank blip, so
          <code>payment_failed</code> sets <code>past_due</code>, starts dunning, and leaves the tier
          alone.
        </p>
        <p>
          This path talks to Postgres directly rather than through the Supabase client, because
          idempotency needs a real transaction and PostgREST gives every call its own.
        </p>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section id="crawlers">
        <h2><span className="num">03 — Crawlers</span>Identity rotates as a unit.</h2>

        <p>
          The common mistake is rotating the proxy and leaving everything else alone. A fresh IP
          carrying the same browser fingerprint, the same timezone and the same locale is trivially
          linkable across sessions — you have not gained a new identity, you have labelled your old
          one. So <strong>fingerprint, timezone, locale and IP rotate together</strong>, and
          <code>crawl_runs</code> records which identity each run wore, so every price point traces
          back to the run and the identity that produced it.
        </p>

        <p>
          Rate limiting is keyed on the <strong>domain</strong>, not the store row: two customers
          watching the same storefront must share one politeness budget, or being popular becomes a
          reason to hammer the target. Failures are per-target, not per-run — a run that fetched 300
          of 312 listings is <code>partial</code>, and <code>crawl_errors</code> says which twelve
          failed and why.
        </p>

        <div className="pull">
          <p>
            And no real retailer is crawled. Three fictional storefronts are built and deployed as
            part of this project, and those are the targets. Legally clean, fully controllable — and
            building the test harness is the more interesting half of the problem anyway.
          </p>
        </div>
      </section>

      <footer>
        <p className="lb">
          Pricevane — a portfolio project by{' '}
          <a href="https://nabilamhaouch.dev">Nabil Amhaouch</a>. Stripe runs in test mode
          throughout; no live keys exist.
        </p>
      </footer>
    </article>
  )
}
