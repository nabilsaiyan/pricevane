-- ============================================================================
-- 0003_usage_limits.sql
--
-- Plan limits enforced where they cannot be bypassed.
--
-- Checking the limit in the route handler is necessary for a good error
-- message, and insufficient as a control: it is one `if` on one code path, and
-- the next import script, admin action or bulk endpoint that forgets it sells
-- the Growth tier for free. The database refuses the row instead, so every path
-- into the table inherits the rule.
-- ============================================================================

create or replace function app.tracked_product_count(org uuid)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from public.products
   where organization_id = org and is_tracked;
$$;

create or replace function app.plan_for(org uuid)
returns public.plan_limits language sql stable security definer set search_path = public, pg_temp as $$
  select pl.* from public.subscriptions s
    join public.plan_limits pl on pl.tier = s.tier
   where s.organization_id = org;
$$;

grant execute on function app.tracked_product_count(uuid), app.plan_for(uuid)
  to authenticated, anon;

create or replace function app.enforce_product_limit()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_limit int;
  v_used  int;
begin
  -- Only additions to the tracked set can breach a cap. Untracking, renaming
  -- or repricing must never be blocked -- least of all for an organization
  -- already over its limit after a downgrade, which would trap them.
  if tg_op = 'UPDATE' and (new.is_tracked = false or old.is_tracked = true) then
    return new;
  end if;
  if tg_op = 'INSERT' and new.is_tracked = false then
    return new;
  end if;

  select pl.max_tracked_products into v_limit
    from public.subscriptions s
    join public.plan_limits pl on pl.tier = s.tier
   where s.organization_id = new.organization_id;

  if v_limit is null then
    raise exception 'organization % has no subscription row', new.organization_id
      using errcode = '23503';
  end if;

  select count(*) into v_used from public.products
   where organization_id = new.organization_id and is_tracked;

  if v_used >= v_limit then
    -- A dedicated SQLSTATE so the API can turn this into an upgrade prompt
    -- rather than a 500. P0001 with a parsed message string would be guesswork.
    raise exception 'plan limit reached: % of % tracked products', v_used, v_limit
      using errcode = 'PV001',
            hint = 'upgrade the plan or untrack a product';
  end if;

  return new;
end;
$$;

create trigger products_enforce_limit
  before insert or update of is_tracked on public.products
  for each row execute function app.enforce_product_limit();

-- Read-only view of where an organization sits against its plan. Powers the
-- usage meter without the client doing arithmetic the server should own.
create or replace view public.usage_summary
with (security_invoker = true) as
  select s.organization_id,
         s.tier,
         s.status,
         pl.max_tracked_products,
         pl.max_competitor_stores,
         pl.checks_per_day,
         -- ::int, not bare count(*): count returns bigint, which every
         -- JavaScript Postgres driver hands back as a STRING to avoid losing
         -- precision past 2^53. A usage meter that compares "25" to 25 is
         -- always under its limit.
         (select count(*)::int from public.products p
           where p.organization_id = s.organization_id and p.is_tracked) as tracked_products,
         (select count(*)::int from public.competitor_stores cs
           where cs.organization_id = s.organization_id and cs.is_active) as active_stores
    from public.subscriptions s
    join public.plan_limits pl on pl.tier = s.tier;

-- security_invoker means the view runs as the caller, so the RLS policy on
-- subscriptions still applies through it. Without that a view is a hole
-- straight through row-level security.
grant select on public.usage_summary to authenticated;
