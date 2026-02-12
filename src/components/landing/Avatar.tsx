/**
 * Drawn portraits for the testimonial cards.
 *
 * These are illustrations, not photographs, and that is deliberate on two
 * counts. The practical one: there is no photograph of Ben T. of Lumen Home,
 * because Lumen Home does not exist. The other: a synthesised photoreal face
 * attached to a quotation nobody said is the one element that would make an
 * openly fictional page read as a forgery, and the footer says outright that
 * every company and quotation here is invented. A drawing is honestly
 * synthetic — it is obviously an illustration at any size — while still giving
 * the section the human presence a wall of monograms cannot.
 *
 * Built from parameters rather than eight hand-drawn files so the set stays
 * consistent and a ninth costs one line. Everything is plain geometry: at
 * 44px the difference between two people has to come from silhouette —
 * hairline, beard, glasses — because nothing finer survives at that size.
 *
 * To use real photographs instead, drop them in public/people/ and swap the
 * <Portrait> call in the STORIES map for an <Image>. Nothing else changes.
 */

export type Face = {
  /** skin, hair, garment */
  skin: string
  hair: string
  shirt: string
  /** silhouette: what actually distinguishes one from another at 44px */
  cut: 'short' | 'crop' | 'wave' | 'curls' | 'receding' | 'tied'
  beard?: 'none' | 'stubble' | 'full' | 'goatee'
  glasses?: boolean
}

/* Warm, cool and deep tones so the row does not read as one person repeated. */
export const SKIN = ['#F0C9A4', '#D9A377', '#B87A4F', '#8A5433', '#5E3A22', '#E8B48C'] as const
export const HAIR = ['#2A1F1A', '#4A342A', '#6B4A32', '#1C1614', '#8A6A4A', '#3A3A3E'] as const

export function Portrait({ f, size = 44 }: { f: Face; size?: number }) {
  const { skin, hair, shirt, cut, beard = 'none', glasses = false } = f
  // A shade under the skin tone, for the jaw shadow and the ear.
  const shade = 'rgba(0,0,0,.14)'

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false"
         className="portrait">
      <defs>
        <clipPath id={`c${cut}${skin.slice(1)}${shirt.slice(1)}`}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath={`url(#c${cut}${skin.slice(1)}${shirt.slice(1)})`}>
        <rect width="64" height="64" fill="#15181A" />

        {/* shoulders */}
        <path d="M4 64c0-13.2 12.5-21 28-21s28 7.8 28 21z" fill={shirt} />
        {/* collar */}
        <path d="M24.5 44.5 32 52l7.5-7.5-3.5-2H28z" fill="rgba(255,255,255,.14)" />

        {/* neck */}
        <path d="M26 34h12v12c0 2-2.6 3.4-6 3.4S26 48 26 46z" fill={skin} />
        <path d="M26 34h12v5c-2.4 2.4-9.6 2.4-12 0z" fill={shade} />

        {/* head */}
        <ellipse cx="32" cy="26" rx="13.4" ry="15.2" fill={skin} />
        {/* ears */}
        <circle cx="18.4" cy="27" r="2.8" fill={skin} />
        <circle cx="45.6" cy="27" r="2.8" fill={skin} />

        {/* eyes and brows — two dots and two strokes is all that survives at
            44px, and it is enough for the face to read as a face. */}
        <circle cx="27" cy="25.5" r="1.5" fill="#1B1512" />
        <circle cx="37" cy="25.5" r="1.5" fill="#1B1512" />
        <path d="M24.4 21.6q2.6-1.4 5.2 0M34.4 21.6q2.6-1.4 5.2 0"
              stroke={hair} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        {/* mouth */}
        <path d="M28.6 33.4q3.4 2.4 6.8 0" stroke="rgba(0,0,0,.42)" strokeWidth="1.4"
              strokeLinecap="round" fill="none" />

        {/* facial hair */}
        {beard === 'stubble' && (
          <path d="M19.2 28c.7 8.4 6.1 13.4 12.8 13.4S44.1 36.4 44.8 28c.6 6-1 15.6-12.8 15.6S18.6 34 19.2 28z"
                fill={hair} opacity=".34" />
        )}
        {beard === 'full' && (
          <path d="M18.8 25.4c0 11.2 5.4 17.6 13.2 17.6s13.2-6.4 13.2-17.6c1.8 8.4.4 20.6-13.2 20.6S17 33.8 18.8 25.4z"
                fill={hair} />
        )}
        {beard === 'goatee' && (
          <path d="M27.4 35.6q4.6 3.2 9.2 0c.6 4.2-1.6 7.4-4.6 7.4s-5.2-3.2-4.6-7.4z" fill={hair} />
        )}

        {/* hair — the silhouette that actually tells two people apart */}
        {cut === 'short' && (
          <path d="M18.6 24.6c-.6-9.4 5.6-14.4 13.4-14.4s14 5 13.4 14.4c-1.2-5.2-3.4-7.4-6.2-8.2-3.4 2.2-11 2.6-14.4.6-3 .8-5 3-6.2 7.6z" fill={hair} />
        )}
        {cut === 'crop' && (
          <path d="M18.8 25c-.4-9.8 5.8-14.8 13.2-14.8S45.6 15.2 45.2 25c-1-3.4-2-5-3.6-5.8-4.4 1.4-13.6 1.4-18-.2-1.8.8-3 2.6-4.8 6z" fill={hair} />
        )}
        {cut === 'wave' && (
          <path d="M18.4 26c-1.4-10.6 5.4-16 13.6-16s15 5.4 13.6 16c-.8-4-2-6.6-4-7.6-2.2 2.4-5.2-1.2-8-.4-3 .8-5.4 3.4-8.4 1.6-2.6 1-4.2 3.4-6.8 6.4z" fill={hair} />
        )}
        {cut === 'curls' && (
          <>
            <path d="M18.4 25.8c-1-10.4 5.8-15.8 13.6-15.8s14.6 5.4 13.6 15.8c-1-4.6-2.6-7-4.6-8-4.6 2-13.8 2-18 .2-2 1-3.4 3.4-4.6 7.8z" fill={hair} />
            {[[22,15],[27.5,11.6],[34,10.8],[40,12.8],[43.6,17],[20.4,20]].map(([x,y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="4.2" fill={hair} />
            ))}
          </>
        )}
        {cut === 'receding' && (
          <path d="M19 25c-.4-6.6 1.6-10.6 4.4-12.2 1 3.4 2.6 5 5 5.2 3.6.4 7.4-1.6 10.6-4 3.4 1.8 6 5.6 6 11-1.4-4.4-3-6.4-4.8-7-4.6 2.2-12.6 2-16.4.2-2 .8-3.4 3-4.8 6.8z" fill={hair} />
        )}
        {cut === 'tied' && (
          <>
            <circle cx="47.4" cy="22.6" r="4.6" fill={hair} />
            <path d="M18.4 25.4c-1.2-10.2 5.6-15.4 13.6-15.4s14.8 5.2 13.6 15.4c-1-4.4-2.4-6.8-4.4-7.8-4.6 1.8-14 1.8-18.2 0-2 1-3.4 3.4-4.6 7.8z" fill={hair} />
          </>
        )}

        {glasses && (
          <g stroke="#20262A" strokeWidth="1.6" fill="rgba(190,215,230,.14)">
            <rect x="21.6" y="21.8" width="9.4" height="7.4" rx="3" />
            <rect x="33" y="21.8" width="9.4" height="7.4" rx="3" />
            <path d="M31 25.4h2M18.8 24.6l2.8.6M45.2 24.6l-2.8.6" fill="none" />
          </g>
        )}
      </g>
      <circle cx="32" cy="32" r="31.2" fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="1.6" />
    </svg>
  )
}
