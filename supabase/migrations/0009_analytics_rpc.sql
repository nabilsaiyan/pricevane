-- The dashboard analytics, as database functions.
--
-- These were written as SQL strings inside the local data layer, which meant
-- the Supabase path had no version of them and the dashboard would come up
-- empty the moment real credentials were plugged in. Moving them into the
-- database gives one definition that both paths call: the local path through
-- pg, PostgREST through /rest/v1/rpc/<name>.
--
-- Every one is SECURITY INVOKER -- the default, stated here because it is the
-- whole point. They run as the caller, so RLS filters the rows before the
-- aggregate sees them. An average computed across another tenant's prices is
-- not a leak anyone would notice in the output, which is exactly why it must
-- be impossible rather than merely unlikely.
--
-- STABLE, so PostgREST will accept them on GET.

create or replace function public.pv_placement(days int default 183)
returns table (day text, tracked int, winning int, win_pct int, median_gap numeric)
language sql stable security invoker set search_path = public as $$
  with snap as (
    select date_trunc('day', s.captured_at)::date as d, m.product_id,
           min(s.price_cents) as best_rival
    from price_snapshots s
    join product_matches m on m.listing_id = s.listing_id and m.status = 'confirmed'
    where s.captured_at >= now() - (days || ' days')::interval
    group by 1, 2
  ), joined as (
    select snap.d, p.our_price_cents as ours, snap.best_rival,
           ((p.our_price_cents - snap.best_rival)::numeric
             / nullif(snap.best_rival, 0)) * 100 as gap
    from snap join products p on p.id = snap.product_id
    where p.is_tracked and p.our_price_cents is not null
  )
  select d::text, count(*)::int,
         count(*) filter (where ours <= best_rival)::int,
         round((count(*) filter (where ours <= best_rival)::numeric
                / nullif(count(*), 0)) * 100)::int,
         round(percentile_cont(0.5) within group (order by gap)::numeric, 1)
  from joined group by d order by d;
$$;

create or replace function public.pv_position()
-- "position" is quoted: it is a reserved word in Postgres (the built-in
-- position(x in y)), so a bare column of that name is a syntax error. Quoting
-- keeps the key the interface already expects rather than renaming it and
-- having to translate on the way out.
returns table (id uuid, title text, our_price_cents int, best_rival int,
               "position" text, gap_pct numeric)
language sql stable security invoker set search_path = public as $$
  with latest as (
    select distinct on (s.listing_id) s.listing_id, s.price_cents
    from price_snapshots s order by s.listing_id, s.captured_at desc
  ), per_product as (
    select p.id, p.title, p.our_price_cents, min(l.price_cents) as best_rival
    from products p
    join product_matches m on m.product_id = p.id and m.status = 'confirmed'
    join latest l on l.listing_id = m.listing_id
    where p.is_tracked and p.our_price_cents is not null
    group by p.id, p.title, p.our_price_cents
  )
  select id, title, our_price_cents, best_rival,
         case when best_rival is null then 'unknown'
              when our_price_cents < best_rival then 'cheapest'
              when our_price_cents = best_rival then 'level'
              else 'beaten' end,
         case when best_rival is null or best_rival = 0 then null
              else round(((our_price_cents - best_rival)::numeric / best_rival) * 100, 1) end
  from per_product order by 6 desc nulls last;
$$;

create or replace function public.pv_sparklines(days int default 60)
returns table (id uuid, title text, our_price_cents int, series int[])
language sql stable security invoker set search_path = public as $$
  select p.id, p.title, p.our_price_cents, array_agg(x.low order by x.d)
  from products p
  join lateral (
    select date_trunc('day', s.captured_at)::date as d, min(s.price_cents) as low
    from product_matches m
    join price_snapshots s on s.listing_id = m.listing_id
    where m.product_id = p.id and m.status = 'confirmed'
      and s.captured_at >= now() - (days || ' days')::interval
    group by 1
  ) x on true
  where p.is_tracked
  group by p.id, p.title, p.our_price_cents
  having count(x.d) > 3
  order by p.title;
$$;

create or replace function public.pv_crawl_activity(days int default 60)
returns table (day text, runs int, failed int)
language sql stable security invoker set search_path = public as $$
  select date_trunc('day', started_at)::date::text, count(*)::int,
         count(*) filter (where status <> 'succeeded')::int
  from crawl_runs
  where started_at >= now() - (days || ' days')::interval
  group by 1 order by 1;
$$;

create or replace function public.pv_movers(days int default 14)
returns table (title text, store text, from_cents int, to_cents int, pct numeric)
language sql stable security invoker set search_path = public as $$
  with bounds as (
    select s.listing_id, min(s.captured_at) as first_at, max(s.captured_at) as last_at
    from price_snapshots s
    where s.captured_at >= now() - (days || ' days')::interval
    group by s.listing_id
  )
  select l.title, st.name, f.price_cents, t.price_cents,
         round(((t.price_cents - f.price_cents)::numeric
                 / nullif(f.price_cents, 0)) * 100, 1)
  from bounds b
  join price_snapshots f on f.listing_id = b.listing_id and f.captured_at = b.first_at
  join price_snapshots t on t.listing_id = b.listing_id and t.captured_at = b.last_at
  join competitor_listings l on l.id = b.listing_id
  join competitor_stores   st on st.id = l.store_id
  where f.price_cents is not null and t.price_cents is not null
    and f.price_cents <> t.price_cents
  order by abs(((t.price_cents - f.price_cents)::numeric
                 / nullif(f.price_cents, 0))) desc
  limit 8;
$$;

create or replace function public.pv_alert_breakdown(days int default 84)
returns table (week text, critical int, warning int, info int)
language sql stable security invoker set search_path = public as $$
  select to_char(date_trunc('week', created_at), 'DD Mon'),
         count(*) filter (where severity = 'critical')::int,
         count(*) filter (where severity = 'warning')::int,
         count(*) filter (where severity = 'info')::int
  from alerts
  where created_at >= now() - (days || ' days')::interval
  group by date_trunc('week', created_at)
  order by date_trunc('week', created_at);
$$;

create or replace function public.pv_store_breakdown()
returns table (store text, listings int, cheapest_on int)
language sql stable security invoker set search_path = public as $$
  with latest as (
    select distinct on (s.listing_id) s.listing_id, s.price_cents
    from price_snapshots s order by s.listing_id, s.captured_at desc
  ), per_listing as (
    select l.store_id, m.product_id, lt.price_cents
    from competitor_listings l
    join product_matches m on m.listing_id = l.id and m.status = 'confirmed'
    join latest lt on lt.listing_id = l.id
  ), best as (
    select product_id, min(price_cents) as best from per_listing group by product_id
  )
  select st.name, count(*)::int,
         count(*) filter (where pl.price_cents = b.best)::int
  from per_listing pl
  join best b on b.product_id = pl.product_id
  join competitor_stores st on st.id = pl.store_id
  group by st.name order by count(*) desc;
$$;

grant execute on function
  public.pv_placement(int), public.pv_position(),
  public.pv_sparklines(int), public.pv_crawl_activity(int),
  public.pv_movers(int), public.pv_alert_breakdown(int),
  public.pv_store_breakdown()
to authenticated;
