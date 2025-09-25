import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { MatchVerdict, type Listing, type MatchExample } from './schema'
import type { MatchProvider } from './provider'

const SYSTEM = `You compare two e-commerce product listings and decide whether they are the same physical product.

Retailers rename, rebrand and re-photograph the same object, so identical titles are rare and differing titles prove nothing on their own. Weigh, in order:

1. Physical specification — dimensions, material, capacity, colour, model number.
2. Manufacturer identity — the same maker under a reseller's own label is still the same product.
3. Price plausibility — a large gap is weak evidence against, never proof.

Two rules that matter more than getting a yes:

- A variant is NOT a match. Different size, different colourway, a two-seat versus three-seat version, a 40cm versus 60cm model — these are different products even when everything else agrees. Say so in differentiators.
- Absence of evidence is not evidence. If the listings simply do not state the attribute that would settle it, lower your confidence rather than guessing. A calibrated 0.6 is far more useful to the reviewer than a confident 0.9 that turns out wrong.

Confidence is a probability, not enthusiasm. Reserve values above 0.9 for cases where a specific shared identifier or an exact specification match settles it.`

function render(l: Listing): string {
  const lines = [`title: ${l.title}`]
  if (l.brand) lines.push(`brand: ${l.brand}`)
  if (l.sku) lines.push(`sku: ${l.sku}`)
  if (typeof l.price_cents === 'number') lines.push(`price: ${(l.price_cents / 100).toFixed(2)}`)
  for (const [k, v] of Object.entries(l.attributes ?? {})) lines.push(`${k}: ${v}`)
  return lines.join('\n')
}

export class ClaudeMatchProvider implements MatchProvider {
  readonly model = 'claude-opus-5'
  private client: Anthropic

  constructor(client?: Anthropic) {
    this.client = client ?? new Anthropic()
  }

  async compare(a: Listing, b: Listing, examples: MatchExample[]): Promise<MatchVerdict> {
    // Examples come first and the pair under test comes last, so the stable
    // prefix (system + examples) stays cacheable while only the tail varies.
    const shots = examples.map(e =>
      `--- example (${e.verdict}) ---\nA:\n${render(e.a)}\nB:\n${render(e.b)}\n` +
      `human verdict: ${e.verdict === 'confirmed' ? 'same product' : 'NOT the same product'}` +
      (e.reason ? `\nbecause: ${e.reason}` : '')
    ).join('\n\n')

    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      system: [{
        type: 'text',
        text: shots ? `${SYSTEM}\n\nPast decisions by this team's reviewers:\n\n${shots}` : SYSTEM,
        // The system prompt plus the examples are identical across every pair
        // in a batch, so caching them turns a per-pair cost into a one-off.
        cache_control: { type: 'ephemeral' },
      }],
      messages: [{
        role: 'user',
        content: `Listing A (our catalogue):\n${render(a)}\n\nListing B (competitor):\n${render(b)}`,
      }],
      output_config: { format: zodOutputFormat(MatchVerdict) },
    })

    // parsed_output is null when the model could not satisfy the schema.
    // Failing loudly beats inventing a verdict.
    if (!response.parsed_output) {
      throw new Error(`matching returned no parseable verdict (stop_reason: ${response.stop_reason})`)
    }
    return response.parsed_output
  }
}
