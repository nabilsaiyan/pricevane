import { Webhook } from 'lucide-react'

/**
 * Third-party marks, in their own colours.
 *
 * Every icon on this page used to be a lucide line glyph in one of two greys
 * or the accent lime. That is why it read flat: the icon *count* was fine, but
 * a page where every mark is the same hue gives the eye nothing to land on, so
 * everything collapses back into text. These are the real silhouettes in the
 * real brand colours, painted through a CSS mask so a file carrying no `fill`
 * still takes its own hex.
 *
 * HONESTY RULE, and it is why `live` exists: a wall of logos is read as a claim
 * of integration. Anything not built says so on its face. Email, Slack and
 * webhooks are genuinely implemented — see src/lib/alerts/delivery.ts and the
 * channel_kind enum in migration 0001. Nothing else is, yet.
 */
export type Brand = {
  id: string; name: string; hex: string; live?: boolean; note?: string
  /** A generic capability with no vendor behind it. Renders a drawn glyph
   *  rather than a mark, because borrowing somebody's logo to stand for a
   *  category implies an integration with them that does not exist. */
  generic?: boolean
}

/** A brand whose official colour is black would be a hole on this ground. */
const INK = '#E8E6E1'

export const DELIVERY: Brand[] = [
  { id: 'resend', name: 'Email', hex: INK, live: true, note: 'Sent through Resend' },
  { id: 'slack', name: 'Slack', hex: '#8C4A8E', live: true, note: 'Incoming webhook' },
  { id: 'webhook', name: 'Webhook', hex: '#C6F24E', live: true,
    note: 'Signed, any endpoint', generic: true },
]

export const SOURCES: Brand[] = [
  { id: 'shopify', name: 'Shopify', hex: '#95BB72' },
  { id: 'woocommerce', name: 'WooCommerce', hex: '#B57BA8' },
  { id: 'googlesheets', name: 'Google Sheets', hex: '#34A853' },
  { id: 'airtable', name: 'Airtable', hex: '#18BFFF' },
  { id: 'notion', name: 'Notion', hex: INK },
  { id: 'n8n', name: 'n8n', hex: '#EA4B71' },
]

export const STACK: Brand[] = [
  { id: 'nextdotjs', name: 'Next.js', hex: INK },
  { id: 'react', name: 'React', hex: '#61DAFB' },
  { id: 'typescript', name: 'TypeScript', hex: '#3178C6' },
  { id: 'postgresql', name: 'PostgreSQL', hex: '#5B7BE8' },
  { id: 'supabase', name: 'Supabase', hex: '#3FCF8E' },
  { id: 'stripe', name: 'Stripe', hex: '#7C75FF' },
  { id: 'tailwindcss', name: 'Tailwind', hex: '#06B6D4' },
  { id: 'gsap', name: 'GSAP', hex: '#0AE448' },
  { id: 'vercel', name: 'Vercel', hex: INK },
]

/** One mark. `size` is the glyph, not whatever tile encloses it. */
export function BrandMark({ b, size = 20 }: { b: Brand; size?: number }) {
  if (b.generic) {
    return <Webhook size={size} color={b.hex} aria-hidden style={{ flex: 'none' }} />
  }
  return (
    <i
      className="bmark"
      aria-hidden
      style={{
        '--bc': b.hex,
        '--bm': `url('/brands/${b.id}.svg')`,
        '--bs': `${size}px`,
      } as React.CSSProperties}
    />
  )
}

/** A labelled tile: the mark, the name, and whether it is real yet. */
export function BrandTile({ b }: { b: Brand }) {
  return (
    <div className={`btile${b.live ? ' live' : ''}`}>
      <BrandMark b={b} size={24} />
      <span className="bname">{b.name}</span>
      {b.note && <span className="bnote">{b.note}</span>}
      <span className="bflag">{b.live ? 'Live' : 'Planned'}</span>
    </div>
  )
}

/** A compact row, for the built-with strip. */
export function BrandRow({ items, label }: { items: Brand[]; label: string }) {
  return (
    <div className="brow" aria-label={label}>
      {items.map(b => (
        <span className="bchip" key={b.id}>
          <BrandMark b={b} size={18} />{b.name}
        </span>
      ))}
    </div>
  )
}
