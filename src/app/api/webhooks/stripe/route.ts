import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getPool } from '@/lib/db'
import { processStripeEvent } from '@/lib/billing/webhook'

// Node, not Edge: we need the raw body and a Postgres socket.
export const runtime = 'nodejs'
// Never cache a webhook.
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // req.text(), never req.json(). Signature verification hashes the exact bytes
  // Stripe sent; parsing and re-serialising changes them and every signature
  // fails.
  const raw = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 })

  const stripe = getStripe()
  let event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    // 400, not 500: the signature is wrong, so retrying cannot help. This is
    // also the only thing standing between an open endpoint and anyone who can
    // POST JSON at it.
    return NextResponse.json(
      { error: `signature verification failed: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 400 },
    )
  }

  try {
    const result = await processStripeEvent(getPool(), event)
    // 'duplicate' is a success. Returning an error would make Stripe retry an
    // event we have already applied, forever.
    return NextResponse.json({ received: true, result })
  } catch (err) {
    console.error('[stripe] failed to process', event.id, event.type, err)
    // 5xx so Stripe retries with backoff. The ledger row was rolled back, so
    // the retry is a clean first attempt rather than a duplicate.
    return NextResponse.json({ error: 'processing failed' }, { status: 500 })
  }
}
