# Pricevane

Competitor price and catalog monitoring. A brand adds the storefronts it wants
watched, maps its products to the equivalent listings on those stores, and wakes
up to a record of every move plus an alert when someone undercuts it.

Built as a portfolio flagship by [Nabil Amhaouch](https://nabilamhaouch.dev).

---

## The three decisions worth explaining

### 1. Tenant isolation lives in the database, not the application

Every tenant-scoped table carries `organization_id` and is protected by a
row-level security policy. There is no code path — ORM, raw SQL, crafted
filter, forgotten `WHERE` — that returns another tenant's rows to an
authenticated user.

Application-layer filtering was rejected because **it fails open**. A missing
`.eq('organization_id', …)` in one handler leaks an entire table and nothing
complains; the tests still pass, because the tests exercise the handler that has
the filter. RLS **fails closed**: forget the filter and the query returns zero
rows. The failure mode of the mechanism should be silence, not disclosure.

Three details that make it hold:

- **`FORCE ROW LEVEL SECURITY`, not just `ENABLE`.** `ENABLE` exempts the table
  owner, and migrations run as the owner.
- **`WITH CHECK` on every write policy, not only `USING`.** `USING` governs what
  you can *see*; `WITH CHECK` governs what you can *write*. With `USING` alone a
  member can `UPDATE` their own row and set `organization_id` to another
  tenant's — moving data across the boundary instead of reading across it.
- **Membership is read through a `SECURITY DEFINER` function with a pinned
  `search_path`.** A policy on `memberships` that queries `memberships` recurses
  infinitely; the definer function breaks the cycle, and the pinned path stops
  anyone shadowing the table from an earlier schema.

`auth.uid()` is wrapped as `(select auth.uid())` throughout, which turns a
per-row call into a once-per-statement InitPlan.

**Proof:** `npm run test:rls` — 17 tests that open a raw Postgres connection,
become the `authenticated` role, and attack the database directly: naming
another org's id, dropping the tenant filter, reaching across a join, counting,
`EXISTS`-probing, inserting into another tenant, and relocating an owned row
across the boundary.

### 2. Stripe webhooks are idempotent through a ledger, not a flag

Stripe guarantees **at-least-once** delivery. The same `evt_…` arrives twice on
timeout, on 5xx, and on its own retry schedule. A replayed `invoice.paid` grants
a second month; a replayed `customer.subscription.deleted` downgrades a customer
who has just resubscribed and paid.

The ledger's **primary key is the Stripe event id**, and the event is claimed in
the *same transaction* as the state change it causes. Applying an event and
recording that it was applied therefore commit or roll back together — there is
no window where one happened and the other did not.

The subtle half is the claim itself:

```sql
insert into stripe_events (id, type, api_version, payload, attempts)
values ($1,$2,$3,$4,1)
on conflict (id) do update
  set attempts = stripe_events.attempts + 1, error = null
where stripe_events.processed_at is null
returning id
```

A plain `INSERT` would be wrong. The failure path records the error under the
same event id, so the ledger row *survives a failure* — and the next delivery
would collide, be called a duplicate, and the event would never be applied. One
transient database blip and that customer's upgrade is lost permanently. This
bug was real; the replay test caught it. Conflicting on an **unprocessed** row
means a previous attempt failed, so we take the claim and retry. Conflicting on
a **processed** row returns nothing, and *that* is the real duplicate.

Two more things the happy path misses:

- **Out-of-order delivery.** Stripe promises delivery, not order. A
  `subscription.updated` created at 10:00 can arrive after the one created at
  10:05, rolling the tier backwards. Every subscription write compares
  `event.created` against a `last_event_at` watermark and drops anything staler.
- **A failed invoice does not downgrade.** Stripe retries for days; cutting
  service off on a temporary card decline is how you lose a paying customer to a
  bank blip. `invoice.payment_failed` sets `past_due` and starts dunning; the
  tier holds.

This path talks to Postgres directly rather than through `supabase-js`, because
idempotency needs a real transaction and PostgREST gives each call its own.

**Proof:** `npm test` — replay, replayed-cancellation-vs-resubscribe,
out-of-order, mid-apply failure and clean retry, and dunning.

### 3. Crawler blocks are handled by rotating identity as a unit

Fingerprint, timezone, locale and IP rotate **together**. Rotating the proxy
alone while keeping one browser fingerprint is what gets a crawler linked across
sessions and blocked. `crawl_runs` records which identity each run wore, so
every data point traces back to the run — and the identity — that produced it.
Per-domain rate limiting is keyed on `competitor_stores.domain`, not on the
store row, because two tenants watching the same storefront must share one
politeness budget.

**We do not crawl real retailers.** Three fictional storefronts are built and
deployed as part of this project and those are the crawl targets. Legally clean,
fully controllable, and building the test harness is more interesting than
scraping someone else's shop.

---

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase (Postgres, Auth,
Storage) · Stripe · GSAP 3.15 + ScrollTrigger · Python + Playwright for crawlers.

## Running it

```bash
cp .env.example .env.local        # fill in; Stripe test keys copy from Cartello
npm install
npm run dev
```

Tests need a throwaway Postgres. They migrate it from scratch on every run, so a
pass means the migrations built the schema, not that leftovers happened to fit:

```bash
docker run -d --name pv-test -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=pricevane -p 55432:5432 postgres:17
npm test
```

## Status

| Phase | | |
|---|---|---|
| 1 | Multi-tenant foundation — schema, RLS, roles, invitations, isolation test | done |
| 2 | Fictional competitor storefronts | next |
| 3 | Crawler pipeline | |
| 4 | Dashboard | |
| 5 | LLM product matching | |
| 6 | Stripe tiers, usage limits, full lifecycle | webhook core done |
| 7 | Alerts — rules, email, Slack, webhook | |
| 8 | Landing page choreography | design approved, ported |
| 9 | `/architecture` page and seeded demo orgs | |
| 10 | Performance, accessibility, reduced-motion pass | |

## Licence notes

GSAP 3.15 is free including ScrollTrigger and SplitText (Webflow, April 2025).
Magic UI is MIT. React Bits is MIT + Commons Clause — usable in a product, not
resellable as components. All are copy-paste rather than dependencies, so the
code here is ours and carries none of their default styling.
