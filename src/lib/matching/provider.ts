import type { Listing, MatchExample, MatchVerdict } from './schema'

export interface MatchProvider {
  /** Stable identifier stored on the row, e.g. 'claude-opus-5'. */
  readonly model: string
  compare(a: Listing, b: Listing, examples: MatchExample[]): Promise<MatchVerdict>
}

export type MatchDecision =
  | { action: 'propose'; status: 'proposed'; confidence: number; reason: string }
  | { action: 'discard'; reason: string }

/**
 * Below this, a positive verdict is not even worth a human's attention -- the
 * queue is a scarce resource and filling it with coin-flips trains people to
 * click through it.
 */
export const REVIEW_FLOOR = 0.55

/**
 * What happens to a verdict.
 *
 * Deliberately, there is no 'auto-apply' branch. A confident model is still a
 * model, and a wrong match silently poisons every price chart and every alert
 * downstream of it -- the failure is invisible precisely because the data still
 * looks plausible. So the model proposes and a human disposes, always. Confidence
 * orders the queue; it does not bypass it.
 */
export function decide(v: MatchVerdict): MatchDecision {
  if (!v.is_match) {
    return { action: 'discard', reason: v.reason }
  }
  if (v.confidence < REVIEW_FLOOR) {
    return { action: 'discard', reason: `below review floor (${v.confidence.toFixed(2)}): ${v.reason}` }
  }
  return { action: 'propose', status: 'proposed', confidence: v.confidence, reason: v.reason }
}
