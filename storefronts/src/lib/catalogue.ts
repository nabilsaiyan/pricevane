/**
 * The three fictional storefronts Pricevane crawls.
 *
 * No real retailer is ever touched. These sites are part of this project, which
 * is legally clean, completely controllable, and lets the crawler be tested
 * against known-correct answers.
 *
 * Prices are a PURE FUNCTION of (sku, store, date). That is deliberate: the
 * storefronts need no database and no cron, yet a crawler run today genuinely
 * sees different numbers from a run yesterday — so the pipeline is exercised by
 * real change rather than by a fixture pretending to move.
 */
export type Store = {
  slug: string; name: string; tagline: string
  accent: string; ground: string; ink: string
  /** Each store renders its own markup, so one selector cannot scrape all three. */
  markup: 'microdata' | 'jsonld' | 'plain'
}

export const STORES: Store[] = [
  { slug: 'northwind', name: 'Northwind Supply', tagline: 'Workspace essentials, shipped flat.',
    accent: '#0F5C4A', ground: '#F6F5F1', ink: '#14171A', markup: 'jsonld' },
  { slug: 'halden', name: 'Halden & Co.', tagline: 'Considered furniture since 1994.',
    accent: '#7A3B2E', ground: '#FBF8F3', ink: '#1B1714', markup: 'microdata' },
  { slug: 'vessel', name: 'Vessel Home', tagline: 'Home, simply.',
    accent: '#2A4C7D', ground: '#FFFFFF', ink: '#101418', markup: 'plain' },
]

export type Item = { sku: string; base: number; titles: Record<string, string> }

export const CATALOGUE: Item[] = [
  { sku: 'TC-4471-BLK', base: 8900, titles: {
    northwind: 'ErgoMesh Office Chair (Black)', halden: 'Task Chair, Mesh Back — Classic',
    vessel: 'Mesh Desk Chair, Black' } },
  { sku: 'SD-1407-OAK', base: 34900, titles: {
    northwind: 'Sit-Stand Desk 140×70 Pro', halden: 'Standing Desk, Oak XL',
    vessel: 'Height Adjustable Desk 140' } },
  { sku: 'SH-5T-OAK', base: 12995, titles: {
    northwind: 'Shelving Unit, Oak Studio', halden: 'Oak Shelf Tower, 5 Tier',
    vessel: 'Open Shelf Unit Home' } },
  { sku: 'LP-BR-01', base: 4400, titles: {
    northwind: 'Table Lamp, Brass', halden: 'Desk Lamp Brass Edition',
    vessel: 'Brass Task Lamp' } },
  { sku: 'DM-FELT-90', base: 2900, titles: {
    northwind: 'Desk Pad, Felt 90cm', halden: 'Felt Desk Mat, Large',
    vessel: 'Desk Mat 90×40' } },
  { sku: 'MA-ARM-02', base: 7900, titles: {
    northwind: 'Screen Mount, Dual', halden: 'Monitor Arm Twin Classic',
    vessel: 'Dual Monitor Arm' } },
]

/** Deterministic hash so the same inputs always give the same price. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) / 4294967296
}

export function priceFor(sku: string, store: string, date = new Date()): number {
  const item = CATALOGUE.find(i => i.sku === sku)
  if (!item) return 0
  const day = Math.floor(date.getTime() / 86_400_000)
  const offset = 0.9 + hash(`${sku}:${store}`) * 0.22          // per-store positioning
  const drift = Math.sin(day / 11 + hash(sku) * 6) * 0.05      // slow movement
  const jitter = (hash(`${sku}:${store}:${day}`) - 0.5) * 0.02 // day-to-day noise
  return Math.round((item.base * offset * (1 + drift + jitter)) / 5) * 5
}

/** One product per store is out of stock on any given day, rotating. */
export function inStock(sku: string, store: string, date = new Date()): boolean {
  const day = Math.floor(date.getTime() / 86_400_000)
  return Math.floor(hash(`${store}:${day}`) * CATALOGUE.length) !== CATALOGUE.findIndex(i => i.sku === sku)
}

export const money = (cents: number) => `€${(cents / 100).toFixed(2)}`
export const getStore = (slug: string) => STORES.find(s => s.slug === slug)
