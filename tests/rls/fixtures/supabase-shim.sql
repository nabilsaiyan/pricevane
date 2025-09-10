create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Minimal stand-in for the parts of Supabase the policies depend on, so the
-- isolation test runs against plain Postgres in CI without the whole platform.
-- It mirrors Supabase's real definitions: same roles, same auth.uid() body.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema if not exists auth;

create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email citext unique
);

-- Byte-for-byte the shape Supabase ships: read `sub` out of the request JWT
-- claims GUC, which PostgREST sets per request from the verified token.
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth   to anon, authenticated, service_role;
grant select on auth.users   to authenticated, service_role;
