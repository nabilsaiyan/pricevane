import { z } from 'zod'

/**
 * What the model must return. Free-form prose would be unusable: the verdict
 * has to be storable, sortable and reviewable, so the schema is the contract.
 */
export const MatchVerdict = z.object({
  is_match: z.boolean()
    .describe('True only if these two listings are the same physical product.'),
  confidence: z.number().min(0).max(1)
    .describe('0 to 1. Be calibrated: 0.5 means genuinely uncertain, not "probably".'),
  reason: z.string().max(400)
    .describe('One or two sentences a human reviewer can check in a few seconds.'),
  differentiators: z.array(z.string()).max(5)
    .describe('Attributes that differ or could not be compared. Empty if none.'),
})

export type MatchVerdict = z.infer<typeof MatchVerdict>

export type Listing = {
  title: string
  brand?: string | null
  sku?: string | null
  price_cents?: number | null
  url?: string | null
  attributes?: Record<string, string> | null
}

export type MatchExample = {
  a: Listing
  b: Listing
  verdict: 'confirmed' | 'rejected'
  reason?: string | null
}
