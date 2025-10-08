import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe } from '@/lib/stripe'
import { getSupabaseServer, getUser } from '@/lib/supabase/server'
import { getPool } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Body = z.object({ organization_id: z.string().uuid() })

/**
 * The Stripe customer portal. Cancellation, payment-method updates and invoice
 * history all live here rather than being rebuilt: Stripe's portal is already
 * PCI-compliant, localised and correct, and every screen we do not write is a
 * screen that cannot drift from Stripe's own state.
 */
export async function POST(req: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'sign in first' }, { status: 401 })

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const supabase = await getSupabaseServer()
  const { data: membership } = await supabase
    .from('memberships').select('role')
    .eq('organization_id', parsed.data.organization_id).maybeSingle()

  if (!membership) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (membership.role === 'member') {
    return NextResponse.json({ error: 'only an owner or admin can manage billing' }, { status: 403 })
  }

  const { rows: [sub] } = await getPool().query(
    `select stripe_customer_id from subscriptions where organization_id = $1`,
    [parsed.data.organization_id])

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'no billing account yet — subscribe first' }, { status: 409 })
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/app/billing`,
  })

  return NextResponse.json({ url: session.url })
}
