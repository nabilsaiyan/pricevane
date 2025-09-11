/**
 * Webhook idempotency, proved by replay.
 *
 * Stripe delivers AT LEAST ONCE. These tests send the same event twice, send
 * events out of order, and fail an event mid-apply, then assert on the actual
 * database state -- not on the handler's return value alone.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Pool } from 'pg'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type Stripe from 'stripe'
import { processStripeEvent } from '../../src/lib/billing/webhook'

const CONN = process.env.TEST_DATABASE_URL
  ?? 'postgres://postgres:postgres@localhost:55432/pricevane'

let pool: Pool
let orgId: string

process.env.STRIPE_PRICE_STARTER = 'price_starter'
process.env.STRIPE_PRICE_GROWTH  = 'price_growth'
process.env.STRIPE_PRICE_SCALE   = 'price_scale'

const CUSTOMER = 'cus_test_1'
const SUB      = 'sub_test_1'

function subEvent(opts: {
  id: string
  type: 'customer.subscription.created' | 'customer.subscription.updated' | 'customer.subscription.deleted'
  price: string
  status?: string
  created: number
  cancelAtPeriodEnd?: boolean
}): Stripe.Event {
  return {
    id: opts.id,
    object: 'event',
    api_version: '2026-05-27.dahlia',
    created: opts.created,
    type: opts.type,
    data: {
      object: {
        id: SUB,
        object: 'subscription',
        customer: CUSTOMER,
        status: opts.status ?? 'active',
        cancel_at_period_end: opts.cancelAtPeriodEnd ?? false,
        items: { data: [{ price: { id: opts.price }, current_period_end: opts.created + 2_592_000 }] },
      },
    },
  } as unknown as Stripe.Event
}

beforeAll(async () => {
  pool = new Pool({ connectionString: CONN })
  const sql = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
  await pool.query(sql('tests/rls/fixtures/reset.sql'))
  await pool.query(sql('tests/rls/fixtures/supabase-shim.sql'))
  await pool.query(sql('supabase/migrations/0001_multitenant_foundation.sql'))
  await pool.query(sql('supabase/migrations/0002_rls_policies.sql'))
})

afterAll(async () => { await pool?.end() })

beforeEach(async () => {
  await pool.query('delete from stripe_events')
  await pool.query('delete from subscriptions')
  await pool.query('delete from organizations')
  const { rows } = await pool.query(
    `insert into organizations (name, slug) values ('Acme','acme-${Date.now()}') returning id`)
  orgId = rows[0].id
  await pool.query(
    `insert into subscriptions (organization_id, tier, status, stripe_customer_id, stripe_subscription_id)
     values ($1,'free','active',$2,$3)`, [orgId, CUSTOMER, SUB])
})

const tier = async () =>
  (await pool.query('select tier, status, last_event_at from subscriptions where organization_id=$1',
    [orgId])).rows[0]

describe('replay safety', () => {
  it('applies an event once', async () => {
    const e = subEvent({ id: 'evt_1', type: 'customer.subscription.created', price: 'price_growth', created: 1_700_000_000 })
    expect(await processStripeEvent(pool, e)).toBe('applied')
    expect((await tier()).tier).toBe('growth')
  })

  it('treats an identical redelivery as a duplicate and does not re-apply', async () => {
    const e = subEvent({ id: 'evt_1', type: 'customer.subscription.created', price: 'price_growth', created: 1_700_000_000 })
    expect(await processStripeEvent(pool, e)).toBe('applied')
    expect(await processStripeEvent(pool, e)).toBe('duplicate')
    expect(await processStripeEvent(pool, e)).toBe('duplicate')

    // One ledger row, one application.
    const { rows } = await pool.query('select count(*)::int n from stripe_events where id=$1', ['evt_1'])
    expect(rows[0].n).toBe(1)
    expect((await tier()).tier).toBe('growth')
  })

  it('a replayed cancellation cannot clobber a fresh resubscribe', async () => {
    // The real-world failure this guards: cancel, then resubscribe, then Stripe
    // redelivers the old cancellation. Without the ledger the customer is
    // silently downgraded after paying.
    const cancel = subEvent({ id: 'evt_cancel', type: 'customer.subscription.deleted', price: 'price_growth', created: 1_700_000_100 })
    expect(await processStripeEvent(pool, cancel)).toBe('applied')
    expect((await tier()).tier).toBe('free')

    const resub = subEvent({ id: 'evt_resub', type: 'customer.subscription.created', price: 'price_scale', created: 1_700_000_200 })
    expect(await processStripeEvent(pool, resub)).toBe('applied')
    expect((await tier()).tier).toBe('scale')

    expect(await processStripeEvent(pool, cancel)).toBe('duplicate')
    expect((await tier()).tier).toBe('scale')   // still paying, still scale
  })
})

describe('out-of-order delivery', () => {
  it('ignores an event older than the one already applied', async () => {
    const newer = subEvent({ id: 'evt_new', type: 'customer.subscription.updated', price: 'price_scale', created: 1_700_005_000 })
    const older = subEvent({ id: 'evt_old', type: 'customer.subscription.updated', price: 'price_starter', created: 1_700_000_000 })

    expect(await processStripeEvent(pool, newer)).toBe('applied')
    expect((await tier()).tier).toBe('scale')

    // Distinct event id, so the ledger does not stop it -- the watermark does.
    expect(await processStripeEvent(pool, older)).toBe('applied')
    expect((await tier()).tier).toBe('scale')

    // It is still recorded as seen.
    const { rows } = await pool.query('select processed_at from stripe_events where id=$1', ['evt_old'])
    expect(rows[0].processed_at).not.toBeNull()
  })
})

describe('failure handling', () => {
  it('rolls the ledger row back so Stripe retries cleanly, and records the error', async () => {
    // No organization_id in metadata -> applyEvent throws mid-transaction.
    const bad = {
      id: 'evt_bad', object: 'event', api_version: 'x', created: 1_700_000_000,
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', object: 'checkout.session', customer: CUSTOMER, subscription: SUB, metadata: {} } },
    } as unknown as Stripe.Event

    await expect(processStripeEvent(pool, bad)).rejects.toThrow(/organization_id/)

    // processed_at null => a retry is a clean first attempt, not a duplicate.
    const { rows } = await pool.query('select processed_at, error, attempts from stripe_events where id=$1', ['evt_bad'])
    expect(rows).toHaveLength(1)
    expect(rows[0].processed_at).toBeNull()
    expect(rows[0].error).toMatch(/organization_id/)

    // And the retry can now succeed without tripping the duplicate guard.
    const good = JSON.parse(JSON.stringify(bad))
    good.data.object.metadata = { organization_id: orgId }
    expect(await processStripeEvent(pool, good as Stripe.Event)).toBe('applied')
    expect(rows[0].attempts).toBe(1)
  })
})

describe('dunning', () => {
  it('marks past_due on a failed invoice without downgrading the tier', async () => {
    await processStripeEvent(pool, subEvent({ id: 'e1', type: 'customer.subscription.created', price: 'price_growth', created: 1_700_000_000 }))
    const failed = {
      id: 'evt_fail', object: 'event', api_version: 'x', created: 1_700_000_500,
      type: 'invoice.payment_failed',
      data: { object: { id: 'in_1', object: 'invoice', customer: CUSTOMER } },
    } as unknown as Stripe.Event

    expect(await processStripeEvent(pool, failed)).toBe('applied')
    const s = await tier()
    expect(s.status).toBe('past_due')
    expect(s.tier).toBe('growth')   // service continues while Stripe retries
  })
})
