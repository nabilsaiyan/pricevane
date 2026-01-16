-- Every organisation gets a settings row at creation.
--
-- 0006 backfilled the organisations that existed when it ran, which is not the
-- same thing: any workspace created afterwards had none, and the settings page
-- would have had to treat "no row yet" as a distinct state -- with the usual
-- consequence that half the code handles it and half does not.
--
-- A trigger closes it at the source, so the row is an invariant rather than
-- something each call path has to remember to create. SECURITY DEFINER because
-- the insert happens as whoever created the organisation, who is not yet an
-- admin of it at that instant and so would be refused by the INSERT policy.

create or replace function app.create_org_settings()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.organization_settings (organization_id)
  values (new.id)
  on conflict (organization_id) do nothing;
  return new;
end;
$$;

drop trigger if exists organizations_settings_ins on public.organizations;
create trigger organizations_settings_ins
  after insert on public.organizations
  for each row execute function app.create_org_settings();

-- Catch anything created between 0006 and this migration.
insert into organization_settings (organization_id)
select id from organizations
on conflict (organization_id) do nothing;
