import Stripe from 'stripe'

/**
 * Same construction as Cartello and pointed at the same test-mode account, so
 * the keys in that project's .env can be copied straight across.
 *
 * The apiVersion is deliberately NOT Cartello's '2026-05-27.dahlia'. Cartello
 * runs stripe@22.2; this is 22.6, whose types pin '2026-08-26.dahlia'. Sharing
 * an account across two pinned versions is fine and normal -- the version
 * travels per request, not per account -- but the two projects must each pin
 * their own, because an unpinned SDK silently follows the account default and
 * Stripe can then change your payload shape without a deploy.
 */
export function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-08-26.dahlia',
    typescript: true,
  })
}

export const TIERS = ['free', 'starter', 'growth', 'scale'] as const
export type Tier = (typeof TIERS)[number]

/** Stripe price id -> our tier. Configured per environment, never hardcoded. */
export function tierFromPriceId(priceId: string | null | undefined): Tier | null {
  if (!priceId) return null
  const map: Record<string, Tier> = {
    [process.env.STRIPE_PRICE_STARTER ?? '_']: 'starter',
    [process.env.STRIPE_PRICE_GROWTH ?? '_']: 'growth',
    [process.env.STRIPE_PRICE_SCALE ?? '_']: 'scale',
  }
  return map[priceId] ?? null
}
