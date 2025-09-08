-- ============================================================================
-- 0001_multitenant_foundation.sql
--
-- Pricevane multi-tenant foundation.
--
-- The organising principle: tenant isolation is a property of the DATABASE,
-- not of the application. Every tenant-scoped table carries organization_id
-- and is protected by a row-level security policy. There is no code path --
-- ORM, raw SQL, crafted filter, or forgotten WHERE clause -- that can return
-- another tenant's rows to an authenticated user. tests/rls proves this.
--
-- Why not application-layer filtering? Because it fails open. A missing
-- `.eq('organization_id', ...)` in one query handler leaks the whole table and
-- nothing complains. RLS fails closed: forget the filter and you get zero rows.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Helper schema.
--
-- These live outside `public` so they are never exposed through PostgREST.
-- ---------------------------------------------------------------------------
create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type app.member_role     as enum ('owner', 'admin', 'member');
create type app.plan_tier       as enum ('free', 'starter', 'growth', 'scale');
create type app.sub_status      as enum ('trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid','paused');
create type app.match_status    as enum ('proposed', 'confirmed', 'rejected');
create type app.run_status      as enum ('queued','running','succeeded','partial','failed');
create type app.stock_state     as enum ('in_stock','out_of_stock','preorder','discontinued','unknown');
create type app.alert_kind      as enum ('undercut','price_drop','price_rise','back_in_stock','out_of_stock','new_product','discontinued');
create type app.alert_severity  as enum ('info','warning','critical');
create type app.channel_kind    as enum ('email','slack','webhook');

-- ===========================================================================
-- TENANCY CORE
-- ===========================================================================

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 120),
  slug        citext not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Demo orgs are seeded, publicly readable, and exempt from billing. They are
  -- how a visitor exercises tenant switching without signing up.
  is_demo     boolean not null default false
);

create table public.memberships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            app.member_role not null default 'member',
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);
-- Both directions are hot: "which orgs am I in" (org switcher) and
-- "who is in this org" (members page).
create index memberships_user_idx on public.memberships (user_id, organization_id);
create index memberships_org_idx  on public.memberships (organization_id);

create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           citext not null,
  role            app.member_role not null default 'member',
  -- We store only a SHA-256 of the token. The raw token exists exactly once,
  -- in the invitation email. A database leak therefore does not hand the
  -- attacker a set of working invitation links.
  token_hash      bytea not null unique,
  invited_by      uuid references auth.users(id) on delete set null,
  expires_at      timestamptz not null,
  accepted_at     timestamptz,
  accepted_by     uuid references auth.users(id) on delete set null,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index invitations_org_idx   on public.invitations (organization_id);
create unique index invitations_pending_uniq
  on public.invitations (organization_id, email)
  where accepted_at is null and revoked_at is null;

-- ===========================================================================
-- HELPER FUNCTIONS
--
-- Every one is SECURITY DEFINER with a pinned search_path.
--
-- SECURITY DEFINER matters for a specific reason: a policy on `memberships`
-- that queries `memberships` re-enters RLS and recurses infinitely. Reading
-- membership through a definer function breaks that cycle. The pinned
-- search_path stops an attacker from shadowing `public.memberships` with a
-- table of their own in a schema earlier on the path.
--
-- STABLE (not VOLATILE) lets the planner call these once per statement and
-- cache the result as an InitPlan, instead of once per candidate row.
-- ===========================================================================

create or replace function app.is_member(org uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org and m.user_id = auth.uid()
  );
$$;

create or replace function app.has_role(org uuid, allowed app.member_role[])
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.role = any(allowed)
  );
$$;

-- Admin means owner OR admin. Spelled once so no policy has to remember it.
create or replace function app.is_admin(org uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.has_role(org, array['owner','admin']::app.member_role[]);
$$;

create or replace function app.is_owner(org uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.has_role(org, array['owner']::app.member_role[]);
$$;

revoke all on function app.is_member(uuid), app.has_role(uuid, app.member_role[]),
                      app.is_admin(uuid), app.is_owner(uuid) from public;
grant execute on function app.is_member(uuid), app.has_role(uuid, app.member_role[]),
                          app.is_admin(uuid), app.is_owner(uuid) to authenticated, anon;

-- ===========================================================================
-- BILLING
-- ===========================================================================

-- Plan limits are DATA, not constants in the codebase. Raising the Growth tier
-- from 500 to 750 tracked products should be an UPDATE, not a deploy.
create table public.plan_limits (
  tier                app.plan_tier primary key,
  max_tracked_products integer not null,
  max_competitor_stores integer not null,
  checks_per_day      integer not null,
  price_id            text,           -- Stripe Price id, test mode
  monthly_price_cents integer not null default 0
);

insert into public.plan_limits (tier, max_tracked_products, max_competitor_stores, checks_per_day, monthly_price_cents) values
  ('free',     25,   1,  1, 0),
  ('starter',  250,  3,  1, 2900),
  ('growth',   1000, 10, 4, 7900),
  ('scale',    10000,50, 24, 24900);

create table public.subscriptions (
  organization_id        uuid primary key references public.organizations(id) on delete cascade,
  tier                   app.plan_tier not null default 'free',
  status                 app.sub_status not null default 'active',
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  -- Set when an invoice fails. Drives the dunning banner and the grace period.
  past_due_since         timestamptz,
  -- Watermark for out-of-order delivery. Stripe does not promise ORDER, only
  -- delivery: a subscription.updated created at 10:00 can arrive after the one
  -- created at 10:05. Applying the older one last would silently roll the tier
  -- backwards. Every subscription write compares event.created against this
  -- and drops anything staler.
  last_event_at          timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- The Stripe event ledger -- the idempotency mechanism.
--
-- Stripe guarantees AT LEAST ONCE delivery. It retries on timeout, on 5xx, and
-- on its own schedule; the same event id can and does arrive twice. Without a
-- ledger, a replayed `invoice.paid` grants a second month, and a replayed
-- `customer.subscription.deleted` can clobber a fresh resubscribe.
--
-- The mechanism: the primary key IS the Stripe event id. The handler INSERTs
-- the event id first, in the SAME transaction as the state change it causes.
-- A duplicate delivery hits the primary key, the insert raises unique_violation,
-- the transaction aborts, and the state change rolls back with it. Applying an
-- event and recording that it was applied therefore succeed or fail together --
-- there is no window where one happened and the other did not.
--
-- `processed_at` null means "seen, still working or failed". That distinction
-- lets us replay genuinely-failed events without replaying successful ones.
-- ---------------------------------------------------------------------------
create table public.stripe_events (
  id            text primary key,               -- Stripe's evt_... id
  type          text not null,
  api_version   text,
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text,
  attempts      integer not null default 0
);
create index stripe_events_unprocessed_idx
  on public.stripe_events (received_at) where processed_at is null;

-- ===========================================================================
-- CATALOG AND COMPETITORS
-- ===========================================================================

create table public.competitor_stores (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  base_url        text not null,
  -- Rate limiting is per DOMAIN, not per store row: two orgs tracking the same
  -- storefront must share one politeness budget or we hammer the target.
  domain          text not null,
  crawl_interval_minutes integer not null default 1440 check (crawl_interval_minutes >= 15),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (organization_id, base_url)
);
create index competitor_stores_org_idx    on public.competitor_stores (organization_id);
create index competitor_stores_domain_idx on public.competitor_stores (domain);

create table public.products (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id              uuid primary key default gen_random_uuid(),
  sku             text not null,
  title           text not null,
  brand           text,
  image_url       text,
  our_price_cents integer check (our_price_cents >= 0),
  currency        char(3) not null default 'EUR',
  is_tracked      boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (organization_id, sku)
);
create index products_org_idx on public.products (organization_id);
-- Powers the product search box.
create index products_title_trgm_idx on public.products using gin (title gin_trgm_ops);

create table public.competitor_listings (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.competitor_stores(id) on delete cascade,
  external_id     text,
  url             text not null,
  title           text not null,
  brand           text,
  image_url       text,
  last_seen_at    timestamptz,
  first_seen_at   timestamptz not null default now(),
  is_active       boolean not null default true,
  unique (store_id, url)
);
create index competitor_listings_org_idx   on public.competitor_listings (organization_id);
create index competitor_listings_store_idx on public.competitor_listings (store_id);

-- ===========================================================================
-- MATCHING
-- ===========================================================================

create table public.product_matches (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id) on delete cascade,
  listing_id      uuid not null references public.competitor_listings(id) on delete cascade,
  status          app.match_status not null default 'proposed',
  confidence      numeric(4,3) not null check (confidence between 0 and 1),
  reason          text,
  model           text,               -- e.g. 'claude-opus-5'. Null for manual matches.
  -- A confirmed OR rejected match is a training example. Rejections matter as
  -- much as confirmations: they teach the model the near-misses it gets wrong.
  reviewed_by     uuid references auth.users(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (product_id, listing_id)
);
create index product_matches_org_idx     on public.product_matches (organization_id);
create index product_matches_product_idx on public.product_matches (product_id);
-- The review queue: proposed matches, most confident first.
create index product_matches_queue_idx
  on public.product_matches (organization_id, confidence desc)
  where status = 'proposed';

-- ===========================================================================
-- CRAWLING AND PRICE HISTORY
-- ===========================================================================

create table public.crawl_runs (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid references public.competitor_stores(id) on delete set null,
  status          app.run_status not null default 'queued',
  started_at      timestamptz,
  finished_at     timestamptz,
  listings_seen   integer not null default 0,
  snapshots_written integer not null default 0,
  -- Which identity this run wore. Proxy, fingerprint, timezone and locale
  -- rotate TOGETHER -- rotating the IP alone while keeping one fingerprint is
  -- what gets a crawler linked across sessions and blocked.
  proxy_label     text,
  user_agent      text,
  locale          text,
  timezone        text,
  error           text,
  created_at      timestamptz not null default now()
);
create index crawl_runs_org_idx   on public.crawl_runs (organization_id, started_at desc);
create index crawl_runs_store_idx on public.crawl_runs (store_id, started_at desc);

-- Per-target outcome inside a run. A run that fetched 300 of 312 listings is
-- 'partial', and this table says exactly which 12 failed and why.
create table public.crawl_errors (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id              bigserial primary key,
  run_id          uuid not null references public.crawl_runs(id) on delete cascade,
  listing_url     text,
  kind            text not null,   -- 'timeout' | 'blocked' | 'captcha' | 'parse' | 'http_4xx' ...
  http_status     integer,
  detail          text,
  occurred_at     timestamptz not null default now()
);
create index crawl_errors_run_idx on public.crawl_errors (run_id);

-- ---------------------------------------------------------------------------
-- price_snapshots is the high-volume table: listings x checks-per-day x time.
--
-- organization_id is DENORMALISED onto it deliberately. The alternative --
-- resolving the tenant through competitor_listings in the policy -- puts a
-- correlated subquery in front of every row scanned on the hottest table we
-- have. Carrying the column costs 16 bytes a row and turns the policy into an
-- index-backed equality test. The FK to competitor_listings plus a trigger-free
-- composite FK keeps the two columns from disagreeing.
-- ---------------------------------------------------------------------------
create table public.price_snapshots (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id              bigserial primary key,
  listing_id      uuid not null references public.competitor_listings(id) on delete cascade,
  run_id          uuid references public.crawl_runs(id) on delete set null,
  price_cents     integer check (price_cents >= 0),
  currency        char(3) not null default 'EUR',
  stock           app.stock_state not null default 'unknown',
  captured_at     timestamptz not null default now()
);
-- The chart query: one listing, a time window, chronological.
create index price_snapshots_listing_time_idx
  on public.price_snapshots (listing_id, captured_at desc);
create index price_snapshots_org_idx on public.price_snapshots (organization_id);
-- BRIN over the append-only timestamp: a fraction of the size of a btree, and
-- the right structure for a table whose physical order tracks captured_at.
create index price_snapshots_captured_brin
  on public.price_snapshots using brin (captured_at);

-- ===========================================================================
-- ALERTS
-- ===========================================================================

create table public.alert_rules (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  kind            app.alert_kind not null,
  -- Percentage move that trips the rule. Null for state changes like stockouts.
  threshold_pct   numeric(6,3),
  product_id      uuid references public.products(id) on delete cascade,
  store_id        uuid references public.competitor_stores(id) on delete cascade,
  severity        app.alert_severity not null default 'warning',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index alert_rules_org_idx on public.alert_rules (organization_id);

create table public.notification_channels (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id              uuid primary key default gen_random_uuid(),
  kind            app.channel_kind not null,
  -- Slack webhook URLs and bearer tokens are credentials. Never selectable by
  -- a member: the column-level grant below hides `secret` from non-admins.
  target          text not null,
  secret          text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index notification_channels_org_idx on public.notification_channels (organization_id);

create table public.alerts (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id              uuid primary key default gen_random_uuid(),
  rule_id         uuid references public.alert_rules(id) on delete set null,
  product_id      uuid references public.products(id) on delete cascade,
  listing_id      uuid references public.competitor_listings(id) on delete cascade,
  kind            app.alert_kind not null,
  severity        app.alert_severity not null default 'warning',
  title           text not null,
  body            text,
  old_price_cents integer,
  new_price_cents integer,
  delivered_at    timestamptz,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index alerts_org_time_idx on public.alerts (organization_id, created_at desc);
create index alerts_unread_idx   on public.alerts (organization_id) where read_at is null;

-- ===========================================================================
-- AUDIT
-- ===========================================================================

create table public.audit_log (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id              bigserial primary key,
  actor_id        uuid references auth.users(id) on delete set null,
  action          text not null,      -- 'member.invited', 'match.confirmed', ...
  entity          text,
  entity_id       uuid,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index audit_log_org_idx on public.audit_log (organization_id, created_at desc);

-- Policy expressions are evaluated as the querying role, so that role needs
-- USAGE on the schema holding the helper functions.
grant usage on schema app to anon, authenticated, service_role;
