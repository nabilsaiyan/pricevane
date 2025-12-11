/**
 * The chip rows the reference leans on heavily -- 45 of them across the page:
 * feature chips under a chapter heading, integration grids, protocol groups,
 * code-language switchers.
 *
 * A chip is a fact you can read in half a second without a sentence being
 * built around it, which is why that page can carry four chapters without
 * feeling like documentation.
 */
export function Chips({
  items, title, more,
}: {
  items: readonly string[]
  title?: string
  more?: string
}) {
  return (
    <div className="chipgrp">
      {title && <span className="chiptitle">{title}</span>}
      <div className="chips">
        {items.map(i => <span className="chip" key={i}>{i}</span>)}
        {more && <span className="chip more">{more}</span>}
      </div>
    </div>
  )
}

/**
 * The provider row.
 *
 * Matching runs through whichever model the customer has a key for. Each slot
 * leaves room for the provider's own mark -- those are their trademarks, so
 * the file goes in `public/providers/` and the slot fills; it is not something
 * to draw an approximation of.
 *
 * Only Anthropic is wired in the running code today (src/lib/matching/claude.ts,
 * model claude-opus-5). The other two are declared here as product intent; the
 * `soon` flag is what stops the page claiming an integration that does not
 * answer yet.
 */
const PROVIDERS = [
  { id: 'anthropic', name: 'Claude', soon: false },
  { id: 'openai', name: 'GPT', soon: true },
  { id: 'google', name: 'Gemini', soon: true },
] as const

export function Providers({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`provs${compact ? ' compact' : ''}`}>
      {PROVIDERS.map(p => (
        <span className={`prov${p.soon ? ' soon' : ''}`} key={p.id} title={p.name}>
          {/* Empty slot: drop /providers/<id>.svg in and it renders. */}
          <i className="provmark" data-provider={p.id} aria-hidden />
          {!compact && <b>{p.name}</b>}
          {!compact && p.soon && <em>soon</em>}
        </span>
      ))}
    </div>
  )
}
