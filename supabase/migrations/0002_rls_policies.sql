-- ============================================================================
-- 0002_rls_policies.sql
--
-- Row-level security. Read 0001's header first for why isolation lives here.
--
-- Three rules govern this file:
--
--   1. ENABLE + FORCE on every table. ENABLE alone still exempts the table
--      OWNER, and migrations run as the owner. FORCE closes that: not even
--      the owning role reads a row a policy would not return.
--
--   2. Deny by default. RLS with zero policies denies everything. Tables that
--      only the server may touch (stripe_events, subscriptions) therefore get
--      RLS enabled and NO policy for `authenticated` -- absence IS the policy.
--      Supabase's service_role bypasses RLS, which is exactly the escape hatch
--      the webhook handler and the crawler need, and nothing else uses.
--
--   3. Every write policy carries WITH CHECK, not just USING. USING filters
--      what you can SEE. WITH CHECK constrains what you can WRITE. A policy
--      with only USING lets a member UPDATE their own row and set
--      organization_id to another tenant's -- moving data across the boundary
--      instead of reading across it. Both halves are required.
--
-- auth.uid() is wrapped as (select auth.uid()) throughout. That turns a
-- per-row function call into a once-per-statement InitPlan. On a 2M-row
-- price_snapshots scan this is the difference between milliseconds and seconds.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Bootstrap RPCs.
--
-- Creating an org and accepting an invitation are both chicken-and-egg: the
-- acting user is not yet a member, so no membership-based policy can authorise
-- them. Rather than punch a hole in the policies for these two cases, both run
-- as SECURITY DEFINER functions that do the whole operation atomically and
-- enforce their own rules. The policies stay strict; the exceptions are two
-- auditable functions instead of a widened rule surface.
-- ---------------------------------------------------------------------------

create or replace function public.create_organization(p_name text, p_slug citext)
returns public.organizations
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_org  public.organizations;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  insert into public.organizations (name, slug) values (p_name, p_slug)
  returning * into v_org;

  -- The creator is always the owner. Not a parameter: making this caller-
  -- supplied would let someone create an org owned by another user.
  insert into public.memberships (organization_id, user_id, role)
  values (v_org.id, v_user, 'owner');

  insert into public.subscriptions (organization_id, tier, status)
  values (v_org.id, 'free', 'active');

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id)
  values (v_org.id, v_user, 'organization.created', 'organization', v_org.id);

  return v_org;
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user  uuid := auth.uid();
  v_email citext;
  v_inv   public.invitations;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select email into v_email from auth.users where id = v_user;

  -- Look up by hash. The raw token never touches the database.
  select * into v_inv from public.invitations
  where token_hash = digest(p_token, 'sha256')
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if v_inv.id is null then
    raise exception 'invitation is invalid, expired, or already used'
      using errcode = '42501';
  end if;

  -- The invitation is bound to the address it was sent to. Without this, a
  -- leaked link is a membership for whoever opens it first.
  if lower(v_inv.email::text) <> lower(v_email::text) then
    raise exception 'this invitation was issued to a different email address'
      using errcode = '42501';
  end if;

  insert into public.memberships (organization_id, user_id, role)
  values (v_inv.organization_id, v_user, v_inv.role)
  on conflict (organization_id, user_id) do nothing;

  update public.invitations
     set accepted_at = now(), accepted_by = v_user
   where id = v_inv.id;

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id)
  values (v_inv.organization_id, v_user, 'member.joined', 'membership', v_inv.id);

  return v_inv.organization_id;
end;
$$;

revoke all on function public.create_organization(text, citext) from public;
revoke all on function public.accept_invitation(text) from public;
grant execute on function public.create_organization(text, citext) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Enable + force on everything.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','memberships','invitations','subscriptions','stripe_events',
    'plan_limits','competitor_stores','products','competitor_listings',
    'product_matches','crawl_runs','crawl_errors','price_snapshots',
    'alert_rules','notification_channels','alerts','audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);
  end loop;
end $$;

-- ===========================================================================
-- ORGANIZATIONS
-- ===========================================================================

-- You see an organization if you belong to it. There is no public read path,
-- not even for demo orgs: the demo seeds real memberships for its anonymous
-- visitor instead of weakening the rule. One rule, no special cases, so the
-- isolation test covers the demo too.
create policy org_select on public.organizations
  for select to authenticated
  using (app.is_member(id));

create policy org_update on public.organizations
  for update to authenticated
  using (app.is_admin(id)) with check (app.is_admin(id));

-- Deleting a tenant cascades to every row it owns. Owners only.
create policy org_delete on public.organizations
  for delete to authenticated
  using (app.is_owner(id));

-- No INSERT policy: organizations are created only through
-- public.create_organization(), which also creates the owner membership.

-- ===========================================================================
-- MEMBERSHIPS
-- ===========================================================================

create policy membership_select on public.memberships
  for select to authenticated
  using (app.is_member(organization_id));

create policy membership_insert on public.memberships
  for insert to authenticated
  with check (app.is_admin(organization_id));

-- The WITH CHECK re-states the org test on purpose: without it an admin could
-- UPDATE a membership row and move that person into an organization they have
-- no rights over.
create policy membership_update on public.memberships
  for update to authenticated
  using (app.is_admin(organization_id))
  with check (app.is_admin(organization_id));

create policy membership_delete on public.memberships
  for delete to authenticated
  using (
    app.is_admin(organization_id)
    -- ...or you are removing yourself. Leaving an org needs no admin.
    or user_id = (select auth.uid())
  );

-- An organization must never be left without an owner, and an admin must not
-- be able to demote or evict the owner. Policies cannot express "count the
-- remaining owners", so this is a trigger.
create or replace function app.protect_last_owner()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owners int;
begin
  if (tg_op = 'DELETE' and old.role = 'owner')
     or (tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner') then
    select count(*) into v_owners
      from public.memberships
     where organization_id = old.organization_id and role = 'owner';
    if v_owners <= 1 then
      raise exception 'an organization must keep at least one owner'
        using errcode = '23514';
    end if;
    -- Only an owner may unseat another owner.
    if not app.is_owner(old.organization_id) then
      raise exception 'only an owner can change or remove another owner'
        using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_protect_last_owner
  before update or delete on public.memberships
  for each row execute function app.protect_last_owner();

-- ===========================================================================
-- INVITATIONS  -- admins manage, nobody else sees them
-- ===========================================================================

create policy invitation_select on public.invitations
  for select to authenticated using (app.is_admin(organization_id));
create policy invitation_insert on public.invitations
  for insert to authenticated with check (app.is_admin(organization_id));
create policy invitation_update on public.invitations
  for update to authenticated
  using (app.is_admin(organization_id)) with check (app.is_admin(organization_id));
create policy invitation_delete on public.invitations
  for delete to authenticated using (app.is_admin(organization_id));

-- ===========================================================================
-- BILLING
--
-- subscriptions is READ-ONLY to every client. Tier and status are decided by
-- Stripe and written only by the webhook handler through service_role. If the
-- browser could write this table, changing your own plan would be a PATCH.
-- ===========================================================================

create policy subscription_select on public.subscriptions
  for select to authenticated using (app.is_member(organization_id));

-- stripe_events: RLS on, no policies. service_role only, by omission.

-- Pricing is public information.
create policy plan_limits_read on public.plan_limits
  for select to authenticated, anon using (true);

-- ===========================================================================
-- TENANT DATA
--
-- Same shape for every table: members read, members write within their own
-- organization, and WITH CHECK pins the destination org on every write.
-- Generated rather than hand-written so no table can quietly acquire a
-- different rule -- uniformity is the property the isolation test relies on.
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'competitor_stores','products','competitor_listings','product_matches',
    'crawl_runs','crawl_errors','price_snapshots','alert_rules','alerts'
  ] loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using (app.is_member(organization_id));
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check (app.is_member(organization_id));
      create policy %1$s_update on public.%1$I for update to authenticated
        using (app.is_member(organization_id))
        with check (app.is_member(organization_id));
      create policy %1$s_delete on public.%1$I for delete to authenticated
        using (app.is_admin(organization_id));
    $f$, t);
  end loop;
end $$;

-- Notification channels hold credentials, so they are admin-only in full.
create policy channel_select on public.notification_channels
  for select to authenticated using (app.is_admin(organization_id));
create policy channel_insert on public.notification_channels
  for insert to authenticated with check (app.is_admin(organization_id));
create policy channel_update on public.notification_channels
  for update to authenticated
  using (app.is_admin(organization_id)) with check (app.is_admin(organization_id));
create policy channel_delete on public.notification_channels
  for delete to authenticated using (app.is_admin(organization_id));

-- RLS cannot hide a COLUMN, only a row. The delivery secret is therefore
-- revoked at the grant level: no client role can select it under any policy.
-- Only service_role, which bypasses RLS entirely, reads it at send time.
revoke select (secret) on public.notification_channels from authenticated, anon;

-- ===========================================================================
-- AUDIT LOG -- append-only from the client's point of view
-- ===========================================================================

create policy audit_select on public.audit_log
  for select to authenticated using (app.is_member(organization_id));
create policy audit_insert on public.audit_log
  for insert to authenticated with check (app.is_member(organization_id));
-- No UPDATE or DELETE policy, by design. An audit trail a user can rewrite is
-- not an audit trail.

-- ===========================================================================
-- GRANTS
--
-- RLS filters rows; GRANT decides whether the role may touch the table at all.
-- Both are needed. Supabase grants broadly to authenticated by default, so we
-- reset and re-grant deliberately.
-- ===========================================================================
revoke all on all tables in schema public from anon, authenticated;

grant select                         on public.plan_limits           to anon, authenticated;
grant select                         on public.organizations,
                                        public.subscriptions,
                                        public.audit_log             to authenticated;
grant select, insert, update, delete on public.memberships,
                                        public.invitations,
                                        public.competitor_stores,
                                        public.products,
                                        public.competitor_listings,
                                        public.product_matches,
                                        public.crawl_runs,
                                        public.crawl_errors,
                                        public.price_snapshots,
                                        public.alert_rules,
                                        public.alerts,
                                        public.notification_channels to authenticated;
grant update, delete                 on public.organizations         to authenticated;
grant insert                         on public.audit_log             to authenticated;
grant usage, select on all sequences in schema public to authenticated;
