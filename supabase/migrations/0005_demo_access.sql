-- ============================================================================
-- 0005_demo_access.sql
--
-- One-click demo access, without weakening a single policy.
--
-- The tempting shortcut is a policy exception: "or the organization is a demo".
-- That would mean the rule the isolation tests exercise is not the rule that
-- runs in production, and the demo would be proving something other than what
-- ships. So demo visitors get REAL memberships instead, granted to a real
-- (anonymous) auth user. Every policy, every test and every query path is
-- identical to a paying customer's.
-- ============================================================================

create or replace function public.join_demo()
returns setof public.organizations
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_org  public.organizations;
begin
  if v_user is null then
    raise exception 'sign in first (anonymous is fine)' using errcode = '42501';
  end if;

  -- `is_demo` is the only thing this function will touch. A caller cannot pass
  -- an organization id, so it cannot be talked into granting membership of a
  -- real tenant.
  for v_org in select * from public.organizations where is_demo loop
    -- 'admin', not 'owner': a visitor should be able to exercise billing,
    -- invitations and the match queue, but not delete the workspace the next
    -- visitor is about to use. org_delete requires owner, and demo orgs have
    -- none, so deletion is impossible rather than merely discouraged.
    insert into public.memberships (organization_id, user_id, role)
    values (v_org.id, v_user, 'admin')
    on conflict (organization_id, user_id) do nothing;

    return next v_org;
  end loop;
end;
$$;

revoke all on function public.join_demo() from public;
grant execute on function public.join_demo() to authenticated;
