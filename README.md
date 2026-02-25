# Pricevane — an AI-powered multi-tenant SaaS for competitor price monitoring

A production-shaped SaaS for small e-commerce teams. It crawls rival storefronts
overnight, matches their listings to your products, and tells you the moment one
of them goes under you — with the product matched, the movement measured, and
the minute it happened.

The hard part is not the crawling, it is knowing that *their* "ErgoMesh Task
Chair, Graphite" is *your* SKU. That is done by an LLM that returns a confidence
and a written reason for every pairing — and never applies one without a human
confirming it.

Subscription billing, per-tenant isolation, plan limits and usage metering are
built the way a real SaaS has to build them: enforced in the database, not in
the interface.

**This is a portfolio project.** Every company, customer, quotation and figure in
the interface is invented, and the shops the crawlers visit are three fictional
storefronts built for the purpose. No real retailer is ever crawled. The
architecture, the isolation tests and the billing ledger are real.

---

## The three decisions worth explaining

Most of this product is ordinary. Three parts are not, and they are the parts
that decide whether it survives contact with real customers.

### 1 · Tenant isolation lives in Postgres, not in application code

Every tenant-scoped table carries an `organization_id` and a row-level security
policy, and the policies are `FORCE`d so they apply to the table owner as well.
There is no path — ORM, raw SQL, crafted filter, forgotten `WHERE` — that
returns one customer's rows to another.

Application-layer filtering was rejected because it fails **open**: a missing
`.eq('organization_id', …)` in one handler leaks a whole table and nothing
complains, because the tests exercise the handler that has the filter. A policy
fails **closed** — get it wrong and you see nothing, which is a bug you find in
the first minute rather than in a disclosure email.

`tests/rls/` signs in as one organisation, crafts a query for another
organisation's rows, and asserts it gets none.

A related trap, found the hard way and now covered by regression tests: a
table-level `GRANT SELECT` silently overrides a column-level `REVOKE`. Secret
columns (`notification_channels.secret`, `organization_settings.api_key_enc`)
are protected by per-column grants in `0007_column_grants.sql`.

### 2 · Stripe webhooks are idempotent by ledger, not by hope

Every event is claimed in an event ledger inside the same transaction that
applies it, keyed on Stripe's own event id. A replay finds the row already
processed and stops. Out-of-order delivery is handled separately, with a
watermark on the subscription — an event that describes an older state than the
one already recorded is discarded rather than applied.

### 3 · The model never merges anything on its own

Matching returns a confidence and a written reason, and everything it proposes
waits for a person to confirm or reject it — at 0.94 and at 0.99 alike. Both
answers are stored and fed back as examples. The `review_floor` setting is a
floor on what is worth a human's attention, never a threshold for acting
automatically.

Plan limits are enforced by a database trigger rather than a check in the
interface, so an over-limit account can still be edited *down* — downgrading
never traps you.

---

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, typed routes), React 19, TypeScript strict |
| Data | Supabase / PostgreSQL, row-level security on every tenant table |
| Billing | Stripe — **test mode only, no live keys anywhere** |
| Matching | Anthropic (wired); OpenAI and Google are selectable but not implemented |
| Charts | Recharts |
| Motion | Native CSS scroll-driven animation (`animation-timeline: view()`), GSAP for what CSS cannot express |
| Email | Resend |
| Capture | Playwright |
| Tests | Vitest — 56, covering RLS isolation, billing idempotency and matching |

## Running it

```bash
npm install
cp .env.example .env.local     # fill in Supabase, Stripe test keys, Resend
npm run db:migrate             # nine migrations, in order
npm run seed                   # two organisations, ~7,600 price snapshots
npm run dev
```

```bash
npm run typecheck
npm test                       # all suites
npm run test:rls               # isolation only — needs a throwaway Postgres
npm run alerts                 # evaluate the alert engine against seeded history
```

`AGENTS.md` is written and re-added by `next dev`; committing it with your work
keeps the tree clean.

## Layout

```
src/app/                 routes — landing, /app dashboard, /architecture, auth
src/app/motion.css       the scroll choreography, and why each range is what it is
src/lib/db/rls.ts        does per request what PostgREST does: sets the JWT claim
                         and the role, so local development has the same boundary
src/lib/data/queries.ts  analytics as SECURITY INVOKER Postgres functions
supabase/migrations/     nine migrations; 0002 and 0007 are the security ones
tests/rls/               adversarial isolation tests
scripts/record/          scripted screen capture for the product clips
```

## Security notes

- Secrets live in environment variables and are never committed.
- Stripe stays in test mode on a dedicated account.
- The crawler visits only the project's own fictional storefronts, rate-limited.
- Third-party marks in `public/brands/` and `public/providers/` are other
  companies' trademarks, shown only against capabilities that exist and never
  presented as a partnership or endorsement. Anything unbuilt is labelled
  *planned* in the interface.

## Licence

Not currently licensed for reuse.
