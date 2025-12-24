-- The suite owns its database. Every run starts from nothing, so a pass means
-- the migrations built this from scratch -- not that leftovers from last time
-- happened to satisfy the assertions.
--
-- What it does NOT do is drop the roles. Roles are cluster-wide while DROP
-- OWNED BY is per-database, so DROP ROLE fails the moment any other database
-- in the same cluster holds a dependent object -- which is exactly what
-- happens once a development database lives alongside this one. The suite has
-- no business deleting a cluster-global principal to clean its own database.
--
-- Nothing is lost by keeping them: the shim creates them only when absent, and
-- everything they owned *here* is dropped below, so this database still starts
-- empty.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'drop owned by authenticated, anon, service_role cascade';
  end if;
end $$;

drop schema if exists app    cascade;
drop schema if exists auth   cascade;
drop schema if exists public cascade;
create schema public;
