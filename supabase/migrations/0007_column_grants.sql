-- Fix two secret columns that were readable by any member of the owning
-- organisation.
--
-- Both tables did this:
--
--     grant select on t to authenticated;
--     revoke select (secret) on t from authenticated;
--
-- which does not work. In Postgres a table-level SELECT grant is not a
-- shorthand for the set of column grants -- it is its own, broader privilege,
-- and a column-level REVOKE cannot carve a hole in it. The revoke succeeds,
-- changes nothing, and the column stays readable. Silent, which is the worst
-- property a permission bug can have.
--
-- The working form is to withhold the table-level grant entirely and grant the
-- columns you actually want, one by one. Anything omitted is then unreachable.
--
-- This is a defence in depth, not the boundary: RLS still decides which ROWS a
-- caller sees. It exists because RLS cannot hide a column, so a member of the
-- right organisation could still read that organisation's webhook secret or
-- vendor API key -- neither of which any interface needs to display.

revoke select on public.notification_channels from authenticated, anon;
grant  select (id, organization_id, kind, target, is_active, created_at)
  on   public.notification_channels to authenticated;

revoke select on public.organization_settings from authenticated, anon;
grant  select (organization_id, match_provider, match_model, review_floor,
               api_key_hint, crawl_hour, crawl_frequency, updated_at, updated_by)
  on   public.organization_settings to authenticated;

-- INSERT and UPDATE stay table-level: writing a secret is legitimate, reading
-- one back is not. The RLS policies still gate who may write at all.
