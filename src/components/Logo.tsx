/**
 * The Pricevane mark.
 *
 * A price holding a level, then stepping down under it. That single step is
 * the event the whole product exists to catch -- the moment a competitor goes
 * under you -- so the logo is the thing being detected rather than an abstract
 * shape chosen to look like a logo.
 *
 * Drawn rather than generated. A mark has to survive a 16px favicon, recolour
 * for a light ground, and stay crisp on any display; a raster image does none
 * of those. Everything here is one rounded tile and one four-point polyline,
 * which is why it still reads at 16px.
 *
 * `tone` picks the two colours rather than inheriting, because the mark is a
 * duotone: on the lime button the tile has to drop out and only the glyph
 * survives, and a single currentColor cannot express that.
 */
export function Mark({ size = 24, tone = 'brand', className }: {
  size?: number
  /** brand: lime tile, ink glyph · ink: dark tile, lime glyph · bare: glyph only */
  tone?: 'brand' | 'ink' | 'bare'
  className?: string
}) {
  const tile = tone === 'brand' ? '#C6F24E' : tone === 'ink' ? '#15181A' : 'none'
  const glyph = tone === 'brand' ? '#08090A' : tone === 'ink' ? '#C6F24E' : 'currentColor'
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
         className={className} aria-hidden focusable="false">
      {tone !== 'bare' && <rect width="32" height="32" rx="7" fill={tile} />}
      <path d={tone === 'bare' ? 'M4 9 H15 V23 H28' : 'M6.5 10.5 H15 V21.5 H25.5'}
            stroke={glyph} strokeWidth={tone === 'bare' ? 3.4 : 3.6}
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Mark plus name. `size` drives the mark; the type follows from the stylesheet. */
export function Wordmark({ size = 22, tone = 'brand', className = 'wm' }: {
  size?: number; tone?: 'brand' | 'ink' | 'bare'; className?: string
}) {
  return (
    <span className={className}>
      <Mark size={size} tone={tone} />
      <span>Price<b>vane</b></span>
    </span>
  )
}
