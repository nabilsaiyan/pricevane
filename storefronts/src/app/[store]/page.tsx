import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CATALOGUE, getStore, priceFor, inStock, money, STORES } from '@/lib/catalogue'

export const dynamic = 'force-dynamic'
export function generateStaticParams() { return STORES.map(s => ({ store: s.slug })) }

export default async function StorePage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params
  const store = getStore(slug)
  if (!store) notFound()

  return (
    <div className="wrap" style={{ '--ground': store.ground, '--ink': store.ink,
                                   '--accent': store.accent } as React.CSSProperties}>
      <div className="masthead"><div className="row">
        <div><h1 style={{ color: store.accent }}>{store.name}</h1><p>{store.tagline}</p></div>
        <nav><Link href="/">All stores</Link></nav>
      </div></div>
      <div className="grid">
        {CATALOGUE.map(item => {
          const price = priceFor(item.sku, slug)
          const stocked = inStock(item.sku, slug)
          return (
            <Link className="card" key={item.sku} href={`/${slug}/p/${item.sku.toLowerCase()}`}>
              <div className="ph">product image</div>
              <div className="body">
                <h2>{item.titles[slug]}</h2>
                <div className="price">{money(price)}</div>
                <div className={`stock ${stocked ? 'in' : 'out'}`}>
                  {stocked ? 'In stock' : 'Out of stock'}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
