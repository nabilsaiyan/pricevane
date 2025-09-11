import type Stripe from 'stripe'
import type { Pool, PoolClient } from 'pg'
import { tierFromPriceId, type Tier } from '@/lib/stripe'

/**
 * Idempotent Stripe webhook processing.
 *
 * WHY THIS TALKS TO POSTGRES DIRECTLY, NOT THROUGH supabase-js
 * ------------------------------------------------------------
 * Idempotency here rests on one guarantee: recording that an event was applied
 * and applying it must be the SAME transaction. supabase-js speaks to PostgREST
 * over HTTP, where each call is its own implicit transaction and there is no
 * BEGIN. Two separate calls leave a window in which the state change committed
 * and the ledger row did not -- and a retry then applies the change twice. So
 * the webhook path uses a direct pooled Postgres connection. It runs as the
 * database owner and bypasses RLS, which is correct: it is the system acting,
 * not a tenant.
 *
 * THE MECHANISM
 * -------------
 * The ledger's primary key IS the Stripe event id. We INSERT it first inside
 * the transaction that performs the state change. A replayed delivery collides
 * on the primary key, raises unique_violation, and the whole transaction --
 * insert AND state change -- rolls back. Applying an event and recording it are
 * therefore atomic: there is no ordering in which one survives without the other.
 *
 * Stripe retries on any non-2xx, so a genuine failure must return 5xx and leave
 * no ledger row. That is exactly what the rollback produces.
 */
export type ProcessResult = 'applied' | 'duplicate' | 'ignored'

const HANDLED = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
])

export async function processStripeEvent(
  pool: Pool,
  event: Stripe.Event,
): Promise<ProcessResult> {
  if (!HANDLED.has(event.type)) {
    // Record it anyway. An unhandled event we have seen is evidence during an
    // incident; an event we never wrote down is a hole in the timeline.
    await pool.query(
      `insert into stripe_events (id, type, api_version, payload, processed_at)
       values ($1,$2,$3,$4, now()) on conflict (id) do nothing`,
      [event.id, event.type, event.api_version, JSON.stringify(event)],
    )
    return 'ignored'
  }

  const client = await pool.connect()
  try {
    await client.query('begin')

    // Claim the event. The conditional upsert is the whole mechanism, and the
    // `where processed_at is null` is the subtle half of it.
    //
    // A plain INSERT would be wrong: the failure path below records the error
    // under the same event id, so the ledger row survives a failure. The next
    // delivery would then collide, be called a duplicate, and the event would
    // NEVER be applied -- one transient database blip and that customer's
    // upgrade is lost permanently.
    //
    // So: conflict on an UNPROCESSED row means a previous attempt failed, and
    // we take the claim and retry. Conflict on a PROCESSED row updates nothing,
    // returns nothing, and that -- rowCount 0 -- is the real duplicate.
    const claim = await client.query(
      `insert into stripe_events (id, type, api_version, payload, attempts)
       values ($1,$2,$3,$4,1)
       on conflict (id) do update
         set attempts = stripe_events.attempts + 1,
             error    = null
       where stripe_events.processed_at is null
       returning id`,
      [event.id, event.type, event.api_version, JSON.stringify(event)],
    )

    if (claim.rowCount === 0) {
      await client.query('rollback')
      return 'duplicate'
    }

    await applyEvent(client, event)

    await client.query(
      `update stripe_events set processed_at = now() where id = $1`, [event.id])
    await client.query('commit')
    return 'applied'
  } catch (err) {
    await client.query('rollback').catch(() => {})
    // Written on a SEPARATE connection: the transaction above is aborted, so
    // nothing can be written on it. Without this the failure leaves no trace.
    await pool.query(
      `insert into stripe_events (id, type, api_version, payload, attempts, error)
       values ($1,$2,$3,$4,1,$5)
       on conflict (id) do update
         set attempts = stripe_events.attempts + 1,
             error    = excluded.error,
             processed_at = null`,
      [event.id, event.type, event.api_version, JSON.stringify(event),
       err instanceof Error ? err.message : String(err)],
    ).catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

async function applyEvent(client: PoolClient, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session
      // organization_id travels in metadata we set when creating the session.
      // Trusting the logged-in user here instead would let someone pay for one
      // org and upgrade another.
      const orgId = s.metadata?.organization_id
      if (!orgId) throw new Error(`checkout session ${s.id} has no organization_id metadata`)
      await client.query(
        `update subscriptions
            set stripe_customer_id     = coalesce($2, stripe_customer_id),
                stripe_subscription_id = coalesce($3, stripe_subscription_id),
                updated_at = now()
          where organization_id = $1`,
        [orgId, asId(s.customer), asId(s.subscription)],
      )
      return
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const deleted = event.type === 'customer.subscription.deleted'
      const tier: Tier = deleted
        ? 'free'
        : tierFromPriceId(sub.items?.data?.[0]?.price?.id) ?? 'free'

      const periodEnd = firstPeriodEnd(sub)

      // The watermark guard. `last_event_at >= to_timestamp($6)` means an
      // out-of-order older event updates zero rows and is a no-op, while still
      // being recorded in the ledger as seen.
      await client.query(
        `update subscriptions
            set tier                 = $2,
                status               = $3::app.sub_status,
                current_period_end   = $4,
                cancel_at_period_end = $5,
                past_due_since       = case when $3 = 'past_due'
                                            then coalesce(past_due_since, now())
                                            else null end,
                last_event_at        = to_timestamp($6),
                updated_at           = now()
          where stripe_subscription_id = $1
            and (last_event_at is null or last_event_at < to_timestamp($6))`,
        [sub.id, tier, deleted ? 'canceled' : sub.status,
         periodEnd, sub.cancel_at_period_end ?? false, event.created],
      )
      return
    }

    case 'invoice.paid': {
      const inv = event.data.object as Stripe.Invoice
      await client.query(
        `update subscriptions
            set status = 'active', past_due_since = null, updated_at = now()
          where stripe_customer_id = $1`,
        [asId(inv.customer)],
      )
      return
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice
      // Dunning starts here. We do NOT downgrade on the first failure: Stripe
      // retries on its own schedule for days, and cutting service off on a
      // temporary card decline is how you lose a paying customer to a bank blip.
      await client.query(
        `update subscriptions
            set status = 'past_due',
                past_due_since = coalesce(past_due_since, now()),
                updated_at = now()
          where stripe_customer_id = $1`,
        [asId(inv.customer)],
      )
      return
    }
  }
}

function asId(v: unknown): string | null {
  if (!v) return null
  return typeof v === 'string' ? v : ((v as { id?: string }).id ?? null)
}

/** Period end moved onto the item in recent API versions; accept both shapes. */
function firstPeriodEnd(sub: Stripe.Subscription): Date | null {
  const item = sub.items?.data?.[0] as { current_period_end?: number } | undefined
  const secs = item?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end
  return typeof secs === 'number' ? new Date(secs * 1000) : null
}
