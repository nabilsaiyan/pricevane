-- ============================================================================
-- 0004_alert_dedupe.sql
--
-- Deduplication for alerts, enforced by the database.
--
-- The engine already filters candidates it has seen, but that check reads a
-- window and then writes — a gap two concurrent crawl runs can both pass
-- through, and the customer gets the same alert twice. A unique index closes
-- it: the second insert loses, and `on conflict do nothing` makes losing
-- harmless rather than an error.
-- ============================================================================

alter table public.alerts
  add column if not exists dedupe_key text;

-- Partial, so historic rows without a key do not collide with each other.
create unique index if not exists alerts_dedupe_uniq
  on public.alerts (organization_id, dedupe_key)
  where dedupe_key is not null;

-- Reading the recent window is the hot path of every alert run.
create index if not exists alerts_org_recent_idx
  on public.alerts (organization_id, created_at desc);
