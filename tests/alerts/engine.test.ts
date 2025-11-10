import { describe, it, expect } from 'vitest'
import { evaluate, dedupe, describe as render, type Rule, type Observation }
  from '../../src/lib/alerts/engine'

const rule = (o: Partial<Rule>): Rule => ({
  id: 'r1', kind: 'undercut', thresholdPct: null, severity: 'warning', ...o,
})

const obs = (o: Partial<Observation>): Observation => ({
  listingId: 'L1', productId: 'P1', storeName: 'Northwind', listingTitle: 'ErgoMesh Chair',
  ourPriceCents: 8900, previous: { priceCents: 9500, stock: 'in_stock' },
  current: { priceCents: 9400, stock: 'in_stock' }, ...o,
})

describe('undercut', () => {
  it('fires on the crossing', () => {
    const hits = evaluate([rule({ kind: 'undercut' })], obs({
      previous: { priceCents: 9500, stock: 'in_stock' },
      current: { priceCents: 7990, stock: 'in_stock' },
    }))
    expect(hits).toHaveLength(1)
    expect(hits[0].newPriceCents).toBe(7990)
  })

  it('does NOT fire again while they simply stay cheaper', () => {
    // The difference between a useful alert and a daily nuisance. Being
    // undercut once must not mean being emailed every morning forever.
    const hits = evaluate([rule({ kind: 'undercut' })], obs({
      previous: { priceCents: 7990, stock: 'in_stock' },
      current: { priceCents: 7950, stock: 'in_stock' },
    }))
    expect(hits).toHaveLength(0)
  })

  it('respects a minimum margin', () => {
    const hits = evaluate([rule({ kind: 'undercut', thresholdPct: 5 })], obs({
      previous: { priceCents: 9500, stock: 'in_stock' },
      current: { priceCents: 8880, stock: 'in_stock' },   // 0.2% under
    }))
    expect(hits).toHaveLength(0)
  })

  it('stays silent when we have no price to compare against', () => {
    expect(evaluate([rule({ kind: 'undercut' })],
      obs({ ourPriceCents: null }))).toHaveLength(0)
  })
})

describe('price movement', () => {
  it('fires a drop past the threshold and not below it', () => {
    const r = [rule({ kind: 'price_drop', thresholdPct: 5 })]
    expect(evaluate(r, obs({ previous: { priceCents: 10000, stock: 'in_stock' },
      current: { priceCents: 9000, stock: 'in_stock' } }))).toHaveLength(1)
    expect(evaluate(r, obs({ previous: { priceCents: 10000, stock: 'in_stock' },
      current: { priceCents: 9900, stock: 'in_stock' } }))).toHaveLength(0)
  })

  it('does not report a rise as a drop', () => {
    expect(evaluate([rule({ kind: 'price_drop', thresholdPct: 1 })],
      obs({ previous: { priceCents: 9000, stock: 'in_stock' },
            current: { priceCents: 10000, stock: 'in_stock' } }))).toHaveLength(0)
  })
})

describe('stock transitions', () => {
  it('fires on entering and returning from out of stock, once each', () => {
    const going = evaluate([rule({ kind: 'out_of_stock' })], obs({
      previous: { priceCents: 9000, stock: 'in_stock' },
      current: { priceCents: null, stock: 'out_of_stock' } }))
    expect(going).toHaveLength(1)

    const staying = evaluate([rule({ kind: 'out_of_stock' })], obs({
      previous: { priceCents: null, stock: 'out_of_stock' },
      current: { priceCents: null, stock: 'out_of_stock' } }))
    expect(staying).toHaveLength(0)

    const back = evaluate([rule({ kind: 'back_in_stock' })], obs({
      previous: { priceCents: null, stock: 'out_of_stock' },
      current: { priceCents: 9000, stock: 'in_stock' } }))
    expect(back).toHaveLength(1)
  })

  it('treats a never-before-seen listing as new', () => {
    expect(evaluate([rule({ kind: 'new_product' })],
      obs({ previous: null }))).toHaveLength(1)
    expect(evaluate([rule({ kind: 'new_product' })], obs({}))).toHaveLength(0)
  })
})

describe('rule scoping', () => {
  it('ignores observations from other products or stores', () => {
    const r = [rule({ kind: 'price_drop', thresholdPct: 1, productId: 'OTHER' })]
    expect(evaluate(r, obs({ previous: { priceCents: 10000, stock: 'in_stock' },
      current: { priceCents: 8000, stock: 'in_stock' } }))).toHaveLength(0)

    const r2 = [rule({ kind: 'price_drop', thresholdPct: 1, storeName: 'Halden' })]
    expect(evaluate(r2, obs({ previous: { priceCents: 10000, stock: 'in_stock' },
      current: { priceCents: 8000, stock: 'in_stock' } }))).toHaveLength(0)
  })

  it('lets one observation trip several rules', () => {
    const hits = evaluate([
      rule({ id: 'a', kind: 'undercut' }),
      rule({ id: 'b', kind: 'price_drop', thresholdPct: 1 }),
    ], obs({ previous: { priceCents: 9500, stock: 'in_stock' },
             current: { priceCents: 7990, stock: 'in_stock' } }))
    expect(hits.map(h => h.ruleId).sort()).toEqual(['a', 'b'])
  })
})

describe('deduplication', () => {
  it('suppresses a condition already alerted in the window', () => {
    const [c] = evaluate([rule({ kind: 'undercut' })], obs({
      previous: { priceCents: 9500, stock: 'in_stock' },
      current: { priceCents: 7990, stock: 'in_stock' } }))
    expect(dedupe([c], new Set([c.dedupeKey]))).toHaveLength(0)
    expect(dedupe([c], new Set())).toHaveLength(1)
  })

  it('suppresses duplicates inside one batch', () => {
    const [c] = evaluate([rule({ kind: 'undercut' })], obs({
      previous: { priceCents: 9500, stock: 'in_stock' },
      current: { priceCents: 7990, stock: 'in_stock' } }))
    expect(dedupe([c, { ...c }], new Set())).toHaveLength(1)
  })

  it('lets a genuinely new movement through', () => {
    // Flapping guard: same listing, different prices, so it is real news.
    const mk = (to: number) => evaluate([rule({ kind: 'price_drop', thresholdPct: 1 })], obs({
      previous: { priceCents: 10000, stock: 'in_stock' },
      current: { priceCents: to, stock: 'in_stock' } }))[0]
    const a = mk(9000), b = mk(8000)
    expect(dedupe([b], new Set([a.dedupeKey]))).toHaveLength(1)
  })
})

describe('wording', () => {
  it('reads like something a person wrote', () => {
    const [c] = evaluate([rule({ kind: 'undercut' })], obs({
      previous: { priceCents: 9500, stock: 'in_stock' },
      current: { priceCents: 7990, stock: 'in_stock' } }))
    const { title, body } = render(c, 'Northwind')
    expect(title).toBe('Northwind undercut you on ErgoMesh Chair')
    expect(body).toBe('Now €79.90 against your €89.00 (-10.2%).')
  })
})
