import { describe, it, expect } from 'vitest'
import { decide, REVIEW_FLOOR, type MatchProvider } from '../../src/lib/matching/provider'
import type { MatchVerdict, Listing, MatchExample } from '../../src/lib/matching/schema'

const verdict = (o: Partial<MatchVerdict>): MatchVerdict => ({
  is_match: true, confidence: 0.8, reason: 'r', differentiators: [], ...o,
})

describe('what happens to a verdict', () => {
  it('proposes a confident match for review', () => {
    const d = decide(verdict({ confidence: 0.97 }))
    expect(d.action).toBe('propose')
    if (d.action === 'propose') expect(d.status).toBe('proposed')
  })

  it('NEVER auto-applies, however confident the model is', () => {
    // The guarantee this whole module exists to provide. A wrong match poisons
    // every chart and alert downstream of it, and looks plausible while doing
    // so, which is why confidence buys queue position and nothing else.
    for (const c of [0.95, 0.99, 1]) {
      const d = decide(verdict({ confidence: c }))
      expect(d.action).toBe('propose')
      if (d.action === 'propose') expect(d.status).toBe('proposed')
    }
  })

  it('discards a negative verdict regardless of confidence', () => {
    expect(decide(verdict({ is_match: false, confidence: 0.99 })).action).toBe('discard')
  })

  it('discards a positive verdict below the review floor', () => {
    expect(decide(verdict({ confidence: REVIEW_FLOOR - 0.01 })).action).toBe('discard')
  })

  it('keeps a verdict sitting exactly on the floor', () => {
    expect(decide(verdict({ confidence: REVIEW_FLOOR })).action).toBe('propose')
  })
})

/** A provider that answers from a lookup table, so the pipeline is testable
 *  without spending a token or depending on the network. */
class FakeProvider implements MatchProvider {
  readonly model = 'fake'
  constructor(private table: Record<string, MatchVerdict>) {}
  seenExamples: MatchExample[] = []
  async compare(a: Listing, b: Listing, examples: MatchExample[]) {
    this.seenExamples = examples
    return this.table[`${a.title}|${b.title}`] ?? verdict({ is_match: false, confidence: 0.1 })
  }
}

describe('the provider seam', () => {
  it('lets the pipeline run against any implementation', async () => {
    const p = new FakeProvider({
      'Task Chair, Ergonomic Mesh|ErgoMesh Office Chair':
        verdict({ confidence: 0.94, reason: 'same mesh task chair, identical stated dimensions' }),
    })
    const v = await p.compare(
      { title: 'Task Chair, Ergonomic Mesh' }, { title: 'ErgoMesh Office Chair' }, [])
    expect(decide(v).action).toBe('propose')
  })

  it('a size variant is rejected, not matched', async () => {
    const p = new FakeProvider({
      'Side Table, 40cm|Occasional Table 60cm':
        verdict({ is_match: false, confidence: 0.88, differentiators: ['diameter 40cm vs 60cm'] }),
    })
    const v = await p.compare({ title: 'Side Table, 40cm' }, { title: 'Occasional Table 60cm' }, [])
    expect(v.differentiators).toContain('diameter 40cm vs 60cm')
    expect(decide(v).action).toBe('discard')
  })

  it('passes rejected examples through, not only confirmed ones', async () => {
    const p = new FakeProvider({})
    const examples: MatchExample[] = [
      { verdict: 'confirmed', a: { title: 'A' }, b: { title: 'B' } },
      { verdict: 'rejected',  a: { title: 'C' }, b: { title: 'D' }, reason: 'different depth' },
    ]
    await p.compare({ title: 'x' }, { title: 'y' }, examples)
    expect(p.seenExamples.filter(e => e.verdict === 'rejected')).toHaveLength(1)
  })
})
