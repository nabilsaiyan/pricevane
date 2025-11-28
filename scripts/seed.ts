/**
 * Seeds two demo organizations with six months of price history.
 *
 * The data has to carry real shapes, because a dashboard over a random walk
 * teaches a visitor nothing. Four patterns are planted deliberately and each is
 * visible in the charts:
 *
 *   seasonal   a slow sinusoidal drift with a one-week promotional trough
 *   price war  two stores undercutting each other in a tightening spiral
 *   stockout   a competitor out of stock for eleven days, price frozen
 *   dead       a listing that stops being seen and is marked discontinued
 *
 * Runs against a direct connection and bypasses RLS, which is what seeding is.
 * Deterministic: the same SEED gives the same six months every time, so a
 * screenshot taken today still matches the data tomorrow.
 */
import { Pool } from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const CONN = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL
if (!CONN) throw new Error('set DATABASE_URL (or TEST_DATABASE_URL) before seeding')

const DAYS = 182
const SEED = 20260830

/** mulberry32 — small, fast, and reproducible across runs. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Pattern = 'seasonal' | 'war' | 'stockout' | 'dead' | 'steady'

type ProductSpec = {
  sku: string; title: string; brand: string; price: number
  image?: string; pattern: Pattern
}

const ORGS = [
  {
    name: 'Northlight Home', slug: 'northlight',
    products: [
      { sku: 'TC-4471-BLK', title: 'Task Chair, Ergonomic Mesh', brand: 'Northlight', price: 8900, image: '/products/web/chair-ergomesh.jpg', pattern: 'war' },
      { sku: 'SD-1407-OAK', title: 'Standing Desk 140×70, Oak', brand: 'Northlight', price: 34900, image: '/products/web/desk-standing.jpg', pattern: 'seasonal' },
      { sku: 'SH-5T-OAK',   title: 'Oak Shelf Unit, 5 Tier',     brand: 'Northlight', price: 12995, image: '/products/web/shelf-oak.jpg', pattern: 'stockout' },
      { sku: 'LP-BR-01',    title: 'Desk Lamp, Brass',           brand: 'Northlight', price: 4400,  image: '/products/web/lamp-brass.jpg', pattern: 'dead' },
      { sku: 'DM-FELT-90',  title: 'Desk Mat, Felt 90×40',       brand: 'Northlight', price: 2900,  pattern: 'steady' },
      { sku: 'MA-ARM-02',   title: 'Monitor Arm, Dual',          brand: 'Northlight', price: 7900,  pattern: 'seasonal' },
      { sku: 'FC-2S-GRY',   title: 'Filing Cabinet, 2 Drawer',   brand: 'Northlight', price: 15900, pattern: 'steady' },
      { sku: 'RG-160-WOO',  title: 'Wool Rug 160×230',           brand: 'Northlight', price: 21900, pattern: 'war' },
    ] as ProductSpec[],
  },
  {
    name: 'Atelier Ferro', slug: 'atelier-ferro',
    products: [
      { sku: 'AF-TB-220',  title: 'Dining Table, Steel & Ash 220', brand: 'Ferro', price: 79900, pattern: 'seasonal' },
      { sku: 'AF-BS-65',   title: 'Bar Stool, Powder Black',       brand: 'Ferro', price: 12900, pattern: 'war' },
      { sku: 'AF-CR-01',   title: 'Coat Rack, Tubular',            brand: 'Ferro', price: 8900,  pattern: 'steady' },
      { sku: 'AF-BK-180',  title: 'Bookcase, Welded 180',          brand: 'Ferro', price: 44900, pattern: 'stockout' },
      { sku: 'AF-SL-40',   title: 'Side Table, 40cm',              brand: 'Ferro', price: 15900, pattern: 'steady' },
      { sku: 'AF-PL-STD',  title: 'Plant Stand, Tripod',           brand: 'Ferro', price: 5900,  pattern: 'dead' },
    ] as ProductSpec[],
  },
]

const STORES = [
  { name: 'Northwind Supply', url: 'https://northwind.pricevane-demo.dev', domain: 'northwind.pricevane-demo.dev' },
  { name: 'Halden & Co.',     url: 'https://halden.pricevane-demo.dev',    domain: 'halden.pricevane-demo.dev' },
  { name: 'Vessel Home',      url: 'https://vessel.pricevane-demo.dev',    domain: 'vessel.pricevane-demo.dev' },
]

/** How a competitor renames the same object. This is what matching must defeat. */
function rename(title: string, storeIdx: number, r: () => number): string {
  const [head] = title.split(',')
  const suffixes = [
    ['Pro', 'Series 2', 'Studio', ''],
    ['XL', 'Classic', 'Edition', ''],
    ['Home', 'Plus', '', 'Mk II'],
  ][storeIdx]
  const s = suffixes[Math.floor(r() * suffixes.length)]
  const swaps: Record<string, string> = {
    'Task Chair': 'ErgoMesh Office Chair', 'Standing Desk': 'Sit-Stand Desk',
    'Oak Shelf Unit': 'Shelving Unit, Oak', 'Desk Lamp': 'Table Lamp',
    'Desk Mat': 'Desk Pad', 'Monitor Arm': 'Screen Mount',
    'Filing Cabinet': 'Drawer Unit', 'Wool Rug': 'Area Rug, Wool',
    'Dining Table': 'Refectory Table', 'Bar Stool': 'Counter Stool',
    'Coat Rack': 'Hall Stand', 'Bookcase': 'Shelving Tower',
    'Side Table': 'Occasional Table', 'Plant Stand': 'Planter Stand',
  }
  return `${swaps[head] ?? head}${s ? ` ${s}` : ''}`
}

async function main() {
  const pool = new Pool({ connectionString: CONN })
  const r = rng(SEED)
  const now = new Date()
  const day = 86_400_000

  console.log('clearing previous demo data…')
  await pool.query(`delete from organizations where is_demo = true`)

  for (const orgSpec of ORGS) {
    const { rows: [org] } = await pool.query(
      `insert into organizations (name, slug, is_demo) values ($1,$2,true) returning id`,
      [orgSpec.name, orgSpec.slug],
    )
    await pool.query(
      `insert into subscriptions (organization_id, tier, status) values ($1,'growth','active')`,
      [org.id])

    // Default rules. Thresholds are the difference between a useful feed and a
    // filtered one: without them a 0.3% wobble emails you every morning, and
    // within a week the whole feed is in a folder nobody opens.
    await pool.query(
      `insert into alert_rules (organization_id, name, kind, threshold_pct, severity) values
         ($1,'Undercut on any product','undercut',      1.0,'critical'),
         ($1,'Competitor price drop',  'price_drop',    5.0,'warning'),
         ($1,'Competitor price rise',  'price_rise',    8.0,'info'),
         ($1,'Competitor out of stock','out_of_stock',  null,'info'),
         ($1,'Competitor restocked',   'back_in_stock', null,'info'),
         ($1,'New competitor listing', 'new_product',   null,'info')`,
      [org.id])

    const storeIds: string[] = []
    for (const s of STORES) {
      const { rows: [row] } = await pool.query(
        `insert into competitor_stores (organization_id, name, base_url, domain)
         values ($1,$2,$3,$4) returning id`,
        [org.id, s.name, s.url, s.domain])
      storeIds.push(row.id)
    }

    // One crawl run per store per day, so every snapshot traces to a run.
    const runIds: string[][] = []
    for (let d = DAYS; d >= 0; d--) {
      const at = new Date(now.getTime() - d * day)
      at.setHours(3, 14, 0, 0)
      const perDay: string[] = []
      for (let si = 0; si < storeIds.length; si++) {
        const blocked = r() < 0.02      // ~2% of runs hit a block, as they do
        const { rows: [run] } = await pool.query(
          `insert into crawl_runs (organization_id, store_id, status, started_at, finished_at,
             listings_seen, proxy_label, user_agent, locale, timezone)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
          [org.id, storeIds[si], blocked ? 'partial' : 'succeeded',
           at, new Date(at.getTime() + 1000 * 60 * (8 + r() * 20)),
           orgSpec.products.length,
           `resi-fr-${1 + Math.floor(r() * 8)}`,
           'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
           'fr-FR', 'Europe/Paris'])
        perDay.push(run.id)
        if (blocked) {
          await pool.query(
            `insert into crawl_errors (organization_id, run_id, kind, http_status, detail)
             values ($1,$2,'blocked',403,'challenge page served; identity rotated and requeued')`,
            [org.id, run.id])
        }
      }
      runIds.push(perDay)
    }

    for (const p of orgSpec.products) {
      const { rows: [prod] } = await pool.query(
        `insert into products (organization_id, sku, title, brand, image_url, our_price_cents)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [org.id, p.sku, p.title, p.brand, p.image ?? null, p.price])

      for (let si = 0; si < storeIds.length; si++) {
        const title = rename(p.title, si, r)
        const { rows: [listing] } = await pool.query(
          `insert into competitor_listings
             (organization_id, store_id, external_id, url, title, brand, image_url,
              first_seen_at, last_seen_at, is_active)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
          [org.id, storeIds[si], `${p.sku}-${si}`,
           `${STORES[si].url}/p/${p.sku.toLowerCase()}-${si}`,
           title, p.brand === 'Northlight' ? 'Northwind' : p.brand, p.image ?? null,
           new Date(now.getTime() - DAYS * day), now, p.pattern !== 'dead' || si !== 0])

        // A confirmed match on the first store, a proposal on the second, so
        // the review queue has something in it and the confirmed set has too.
        if (si === 0) {
          await pool.query(
            `insert into product_matches (organization_id, product_id, listing_id, status,
               confidence, reason, model, reviewed_at)
             values ($1,$2,$3,'confirmed',$4,$5,'claude-opus-5',now())`,
            [org.id, prod.id, listing.id, 0.9 + r() * 0.09,
             `Same object under a different name: identical stated dimensions and material, SKU differs by vendor convention.`])
        } else if (si === 1) {
          await pool.query(
            `insert into product_matches (organization_id, product_id, listing_id, status,
               confidence, reason, model)
             values ($1,$2,$3,'proposed',$4,$5,'claude-opus-5')`,
            [org.id, prod.id, listing.id, 0.62 + r() * 0.28,
             `Titles differ and no shared identifier; specification overlap is strong but the finish may not match.`])
        }

        // ---- the six months -------------------------------------------------
        const base = p.price * (0.94 + si * 0.03 + r() * 0.05)
        let price = base
        const rows: string[] = []
        const vals: unknown[] = []
        let n = 0

        for (let d = DAYS; d >= 0; d--) {
          const at = new Date(now.getTime() - d * day)
          at.setHours(3, 14, 0, 0)
          const t = (DAYS - d) / DAYS
          let stock: string = 'in_stock'

          switch (p.pattern) {
            case 'seasonal': {
              const season = Math.sin(t * Math.PI * 2) * 0.05
              // A one-week promotional trough. Deliberately NOT called Black
              // Friday: the window is the last 182 days, so depending on when
              // you seed it may land nowhere near November, and a label that
              // contradicts its own timestamps is worse than no label.
              const promo = d > 88 && d < 96 ? -0.18 : 0
              price = base * (1 + season + promo) * (1 + (r() - 0.5) * 0.004)
              break
            }
            case 'war': {
              // Two stores undercut each other in a tightening spiral.
              if (si < 2 && d < 70 && d % 9 === si * 4) price *= 0.972
              price *= 1 + (r() - 0.5) * 0.003
              break
            }
            case 'stockout': {
              if (si === 2 && d <= 41 && d >= 30) { stock = 'out_of_stock' }
              else price = base * (1 + Math.sin(t * 3) * 0.03) * (1 + (r() - 0.5) * 0.004)
              break
            }
            case 'dead': {
              if (si === 0 && d < 34) { stock = 'discontinued' }
              else price *= 1 + (r() - 0.5) * 0.004
              break
            }
            default:
              price = base * (1 + (r() - 0.5) * 0.012)
          }

          if (stock === 'discontinued') continue      // stops being seen at all

          const runId = runIds[DAYS - d][si]
          vals.push(org.id, listing.id, runId, Math.round(price), stock, at)
          rows.push(`($${n * 6 + 1},$${n * 6 + 2},$${n * 6 + 3},$${n * 6 + 4},$${n * 6 + 5}::app.stock_state,$${n * 6 + 6})`)
          n++
        }

        await pool.query(
          `insert into price_snapshots
             (organization_id, listing_id, run_id, price_cents, stock, captured_at)
           values ${rows.join(',')}`, vals)

        // An alert wherever a competitor crossed under us in the last fortnight.
        if (si === 0 && price < p.price * 0.97) {
          await pool.query(
            `insert into alerts (organization_id, product_id, listing_id, kind, severity,
               title, body, old_price_cents, new_price_cents, created_at)
             values ($1,$2,$3,'undercut','critical',$4,$5,$6,$7,$8)`,
            [org.id, prod.id, listing.id,
             `${STORES[si].name} dropped ${title} to €${(price / 100).toFixed(2)}`,
             `${(((price - p.price) / p.price) * 100).toFixed(1)}% against your €${(p.price / 100).toFixed(2)}`,
             p.price, Math.round(price),
             new Date(now.getTime() - Math.floor(r() * 12) * day)])
        }
      }
    }

    const { rows: [c] } = await pool.query(
      `select count(*)::int n from price_snapshots where organization_id = $1`, [org.id])
    console.log(`  ${orgSpec.name.padEnd(18)} ${orgSpec.products.length} products · ${c.n} snapshots`)
  }

  await pool.end()
  console.log('done.')
}

main().catch(e => { console.error(e); process.exit(1) })
