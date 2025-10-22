'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getMemberships, ACTIVE_ORG_COOKIE } from '@/lib/auth/org'

/**
 * Switch the active organization.
 *
 * The submitted id is checked against the caller's real memberships before the
 * cookie is written. Not because the cookie is dangerous — RLS ignores it
 * entirely — but because silently accepting an id the user has no claim to
 * would leave them staring at an empty dashboard with no explanation.
 */
export async function switchOrg(formData: FormData) {
  const id = String(formData.get('organization_id') ?? '')
  const memberships = await getMemberships()
  if (!memberships.some(m => m.organization_id === id)) return

  ;(await cookies()).set(ACTIVE_ORG_COOKIE, id, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365,
  })
  revalidatePath('/app', 'layout')
}

/**
 * Confirm or reject a proposed match.
 *
 * The update names the match id and nothing else — no organization_id filter.
 * RLS supplies it, so a forged id from another tenant updates zero rows rather
 * than needing a check here that a future refactor could drop.
 */
export async function reviewMatch(formData: FormData) {
  const id = String(formData.get('match_id') ?? '')
  const verdict = String(formData.get('verdict') ?? '')
  if (verdict !== 'confirmed' && verdict !== 'rejected') return

  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  await supabase.from('product_matches')
    .update({ status: verdict, reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
    .eq('id', id)

  // Both outcomes are training data. A rejection teaches the model the
  // near-miss it got wrong, which is the half most systems throw away.
  const { data: match } = await supabase
    .from('product_matches').select('organization_id').eq('id', id).maybeSingle()
  if (match) {
    await supabase.from('audit_log').insert({
      organization_id: match.organization_id,
      actor_id: user?.id,
      action: `match.${verdict}`,
      entity: 'product_match',
      entity_id: id,
    })
  }

  revalidatePath('/app/matches')
}
