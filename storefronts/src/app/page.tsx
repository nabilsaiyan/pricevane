import Link from 'next/link'
import { STORES } from '@/lib/catalogue'

export default function Index() {
  return (
    <div className="wrap">
      <div className="masthead"><div className="row">
        <div><h1>Pricevane demo storefronts</h1>
          <p>Three fictional shops. These are the only sites the crawler touches.</p></div>
      </div></div>
      <div className="storelist">
        {STORES.map(s => (
          <Link key={s.slug} href={`/${s.slug}`}>
            <strong>{s.name}</strong>
            <div style={{ fontSize: 13, opacity: .62, marginTop: 4 }}>
              {s.tagline} — markup style: {s.markup}
            </div>
          </Link>
        ))}
      </div>
      <p style={{ fontSize: 13, opacity: .6, maxWidth: '60ch', paddingBottom: 40 }}>
        Each store renders its product data differently — JSON-LD, microdata, or plain markup — so
        a single selector cannot scrape all three. That is the point: it is the problem a real
        crawler has, reproduced somewhere it is legal to solve.
      </p>
    </div>
  )
}
