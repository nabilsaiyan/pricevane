-- Per-organisation settings: which model does the matching, how confident it
-- must be before a human is even shown the proposal, and how often we crawl.
--
-- These are per tenant rather than global because they are commercial choices,
-- not deployment ones: one workspace may hold an Anthropic key and another an
-- OpenAI key, and the review floor is a risk appetite that differs by catalogue.

create table if not exists organization_settings (
  organization_id uuid primary key
    references organizations (id) on delete cascade,

  -- Which vendor answers a matching call. Constrained rather than free text so
  -- a typo cannot silently route to a provider that does not exist.
  match_provider  text not null default 'anthropic'
    check (match_provider in ('anthropic', 'openai', 'google')),
  match_model     text not null default 'claude-opus-5',

  -- Below this, a proposal is discarded rather than shown. It is a floor on
  -- what is worth a human's attention, never a threshold for auto-applying:
  -- nothing is ever applied without confirmation, at any confidence.
  review_floor    numeric(3,2) not null default 0.55
    check (review_floor >= 0 and review_floor <= 1),

  -- The vendor API key, encrypted at rest with pgcrypto. The column is
  -- revoked from `authenticated` below, so it is unreadable through the API
  -- even by a member of the owning organisation -- RLS scopes rows, it cannot
  -- hide a column. Only the service role, which does the matching, can read it.
  api_key_enc     bytea,
  api_key_hint    text,               -- last four characters, safe to display

  crawl_hour      smallint not null default 2
    check (crawl_hour between 0 and 23),
  crawl_frequency text not null default 'nightly'
    check (crawl_frequency in ('nightly', 'twice_daily', 'weekly')),

  updated_at      timestamptz not null default now(),
  updated_by      uuid
);

alter table organization_settings enable row level security;
alter table organization_settings force row level security;

-- Read: any member. Write: admins and owners only -- changing which model runs
-- the matching, or lowering the review floor, is an administrative act.
create policy org_settings_select on organization_settings
  for select using (app.is_member(organization_id));

create policy org_settings_insert on organization_settings
  for insert with check (app.is_admin(organization_id));

create policy org_settings_update on organization_settings
  for update using (app.is_admin(organization_id))
       with check (app.is_admin(organization_id));

grant select, insert, update on organization_settings to authenticated;

-- The key ciphertext and its column are never selectable by a normal caller.
revoke select (api_key_enc) on organization_settings from authenticated, anon;

-- Give every existing organisation a row, so the settings page never has to
-- deal with "no row yet" as a distinct state.
insert into organization_settings (organization_id)
select id from organizations
on conflict (organization_id) do nothing;
