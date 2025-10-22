import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { getReviewQueue } from '@/lib/data/queries'
import { reviewMatch } from '../actions'

export const dynamic = 'force-dynamic'

type Row = Awaited<ReturnType<typeof getReviewQueue>>[number]

export default async function Matches() {
  const queue = await getReviewQueue()

  return (
    <>
      <div className="head">
        <div>
          <h1>Matches</h1>
          <p>
            {queue.length} proposed. Nothing here is applied until you say so — a wrong match
            silently distorts every chart and alert downstream of it.
          </p>
        </div>
      </div>

      {queue.length === 0 && <div className="card"><div className="empty">Queue is clear.</div></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {queue.map((m: Row) => {
          const p = m.products as unknown as
            { title: string; sku: string; brand: string | null; our_price_cents: number | null; image_url: string | null } | null
          const l = m.competitor_listings as unknown as
            { title: string; url: string; brand: string | null; image_url: string | null;
              competitor_stores: { name: string } | null } | null
          const score = Number(m.confidence)

          return (
            <section className="card" key={m.id}>
              <header>
                <h2>{p?.title ?? 'Product'}</h2>
                <span className={`pill ${score >= 0.85 ? 'warn' : 'ok'}`}>
                  confidence {score.toFixed(2)}
                </span>
              </header>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                            gap: '1rem', alignItems: 'center', padding: '1.05rem' }}>
                <Side title={p?.title} meta={`${p?.sku ?? ''}${p?.brand ? ` · ${p.brand}` : ''}`}
                      price={p?.our_price_cents ?? null} img={p?.image_url ?? null} tag="Your catalogue" />
                <ArrowRight size={18} color="var(--t3)" aria-hidden />
                <Side title={l?.title} meta={l?.competitor_stores?.name ?? ''}
                      price={null} img={l?.image_url ?? null} tag="Competitor" href={l?.url} />
              </div>

              {m.reason && (
                <p style={{ borderTop: '1px solid var(--rule)', margin: 0, padding: '.85rem 1.05rem',
                            color: 'var(--t2)', fontSize: 12.5, lineHeight: 1.55 }}>
                  <span className="lb" style={{ marginRight: '.5rem' }}>{m.model ?? 'model'}</span>
                  {m.reason}
                </p>
              )}

              <footer style={{ display: 'flex', gap: '.6rem', padding: '.85rem 1.05rem',
                               borderTop: '1px solid var(--rule)' }}>
                <form action={reviewMatch}>
                  <input type="hidden" name="match_id" value={m.id} />
                  <input type="hidden" name="verdict" value="confirmed" />
                  <button className="btn2" type="submit">Same product</button>
                </form>
                <form action={reviewMatch}>
                  <input type="hidden" name="match_id" value={m.id} />
                  <input type="hidden" name="verdict" value="rejected" />
                  <button className="btn2 ghost" type="submit">Not a match</button>
                </form>
                <span className="lb" style={{ alignSelf: 'center', marginLeft: 'auto' }}>
                  Both answers become training examples
                </span>
              </footer>
            </section>
          )
        })}
      </div>
    </>
  )
}

function Side({ title, meta, price, img, tag, href }: {
  title?: string; meta: string; price: number | null
  img: string | null; tag: string; href?: string
}) {
  return (
    <div>
      <span className="lb">{tag}</span>
      {img && (
        <Image src={img} alt="" width={520} height={390}
               style={{ width: '100%', height: 'auto', aspectRatio: '4/3', objectFit: 'cover',
                        border: '1px solid var(--rule)', borderRadius: 4, margin: '.5rem 0' }} />
      )}
      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.01em', marginTop: img ? 0 : '.5rem' }}>
        {href ? <a href={href} target="_blank" rel="noreferrer noopener"
                   style={{ color: 'var(--t1)', textDecoration: 'none' }}>{title}</a> : title}
      </div>
      <div className="lb" style={{ marginTop: '.35rem' }}>{meta}</div>
      {price != null && (
        <div style={{ fontFamily: 'var(--fm)', fontVariantNumeric: 'tabular-nums',
                      fontSize: '1.15rem', marginTop: '.4rem' }}>
          €{(price / 100).toFixed(2)}
        </div>
      )}
    </div>
  )
}
