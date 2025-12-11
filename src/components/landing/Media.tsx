/**
 * An empty, labelled media slot.
 *
 * The reference page carries 32 media elements -- a 1046x744 hero screenshot,
 * a 1026x577 video embed, two ~500px feature stills, and a wall of avatars.
 * None of that exists for Pricevane yet, and inventing a substitute (a DOM
 * mock dressed as a screenshot, a stock illustration) is how a portfolio piece
 * ends up looking like it is hiding something.
 *
 * So the slot is empty and says what belongs in it, at the exact aspect ratio
 * of the real asset. Drop a file in and it fills; the layout does not move,
 * because the box already reserves the space.
 */
export function Media({
  w, h, label, hint, kind = 'image',
}: {
  w: number
  h: number
  label: string
  hint?: string
  kind?: 'image' | 'video' | 'avatar'
}) {
  return (
    <div
      className={`ph ph-${kind}`}
      style={{ aspectRatio: `${w} / ${h}` }}
      role="img"
      aria-label={`Placeholder: ${label}`}
    >
      <div className="ph-in">
        <span className="ph-kind">{kind === 'video' ? 'Video' : kind === 'avatar' ? 'Photo' : 'Image'}</span>
        <span className="ph-label">{label}</span>
        <span className="ph-dim">{w} &times; {h}</span>
        {hint && <span className="ph-hint">{hint}</span>}
      </div>
    </div>
  )
}
