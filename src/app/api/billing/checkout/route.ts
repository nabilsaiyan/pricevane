import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe } from '@/lib/stripe'
import { getSupabaseServer, getUser } from '@/lib/supabase/server'
import { getPool } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Body = z.object({
  organization_id: z.string().uuid(),
  tier: z.enum(['starter', 'growth', 'scale']),
})

const PRICE: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  growth: process.env.STRIPE_PRICE_GROWTH,
  scale: process.env.STRIPE_PRICE_SCALE,
}

export async function POST(req: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'sign in first' }, { status: 401 })

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  const { organization_id, tier } = parsed.data

  // Authorisation by SELECT. This read runs under the user's own session, so
  // RLS returns the membership only if it is genuinely theirs -- there is no
  // separate permission check to forget, and a crafted organization_id simply
  // finds nothing.
  const supabase = await getSupabaseServer()
  const { data: membership } = await supabase
    .from('memberships').select('role')
    .eq('organization_id', organization_id).maybeSingle()

  if (!membership) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (membership.role === 'member') {
    return NextResponse.json({ error: 'only an owner or admin can change the plan' }, { status: 403 })
  }

  const price = PRICE[tier]
  if (!price) return NextResponse.json({ error: `no price configured for ${tier}` }, { status: 500 })

  const pool = getPool()
  const { rows: [sub] } = await pool.query(
    `select stripe_customer_id, stripe_subscription_id from subscriptions
      where organization_id = $1`, [organization_id])

  const stripe = getStripe()
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Already subscribed: this is a plan CHANGE, not a new checkout. Sending them
  // through Checkout again creates a second subscription on the same customer
  // and bills them twice. Stripe prorates the swap on the existing item.
  if (sub?.stripe_subscription_id) {
    const current = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: current.items.data[0].id, price }],
      proration_behavior: 'create_prorations',
      // The webhook writes the tier. Never here: the response to this request
      // and the event that confirms it must not be two sources of truth.
      metadata: { organization_id },
    })
    return NextResponse.json({ changed: true })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    customer: sub?.stripe_customer_id ?? undefined,
    client_reference_id: organization_id,
    // Carried on the session AND the subscription, because the two event
    // families arrive separately and each has to be attributable on its own.
    metadata: { organization_id },
    subscription_data: { metadata: { organization_id } },
    success_url: `${base}/app/billing?checkout=done`,
    cancel_url: `${base}/app/billing?checkout=cancelled`,
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
