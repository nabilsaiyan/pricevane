-- The suite owns its database. Every run starts from nothing, so a pass means
-- the migrations built this from scratch -- not that leftovers from last time
-- happened to satisfy the assertions.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'drop owned by authenticated, anon, service_role cascade';
    execute 'drop role authenticated, anon, service_role';
  end if;
end $$;

drop schema if exists app    cascade;
drop schema if exists auth   cascade;
drop schema if exists public cascade;
create schema public;
