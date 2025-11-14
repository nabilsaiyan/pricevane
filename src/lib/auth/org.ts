import { cache } from 'react'
import { getSupabaseServer } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export type Role = 'owner' | 'admin' | 'member'

export type Membership = {
  organization_id: string
  role: Role
  organizations: { id: string; name: string; slug: string; is_demo: boolean }
}

const ACTIVE_ORG_COOKIE = 'pv_org'

/**
 * Every organization the signed-in user belongs to.
 *
 * No organization_id filter is passed and none is needed — RLS returns only
 * the caller's own memberships. `cache` dedupes this across a render tree.
 */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  if (!isSupabaseConfigured()) return []
  const supabase = await getSupabaseServer()
  const { data, error } = await supabase
    .from('memberships')
    .select('organization_id, role, organizations(id, name, slug, is_demo)')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as Membership[]
})

/**
 * The active organization.
 *
 * The cookie is a *preference*, not a credential. It is validated against the
 * user's real memberships on every call, so editing it to another tenant's id
 * selects nothing — and even if this function were skipped entirely, RLS would
 * still return zero rows. Two independent layers, neither relied upon alone.
 */
export const getActiveOrg = cache(async (): Promise<Membership | null> => {
  const memberships = await getMemberships()
  if (memberships.length === 0) return null

  const wanted = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value
  return memberships.find(m => m.organization_id === wanted) ?? memberships[0]
})

export async function requireActiveOrg(): Promise<Membership> {
  const org = await getActiveOrg()
  if (!org) throw new Error('no organization for this user')
  return org
}

export function canManage(role: Role) { return role === 'owner' || role === 'admin' }
export { ACTIVE_ORG_COOKIE }
