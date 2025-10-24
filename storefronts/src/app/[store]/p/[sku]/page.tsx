import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CATALOGUE, getStore, priceFor, inStock, money } from '@/lib/catalogue'

export const dynamic = 'force-dynamic'

export default async function Product({ params }: {
  params: Promise<{ store: string; sku: string }>
}) {
  const { store: slug, sku: rawSku } = await params
  const store = getStore(slug)
  const item = CATALOGUE.find(i => i.sku.toLowerCase() === rawSku.toLowerCase())
  if (!store || !item) notFound()

  const price = priceFor(item.sku, slug)
  const stocked = inStock(item.sku, slug)
  const title = item.titles[slug]
  const availability = stocked ? 'InStock' : 'OutOfStock'

  return (
    <div className="wrap" style={{ '--ground': store.ground, '--ink': store.ink,
                                   '--accent': store.accent } as React.CSSProperties}>
      <div className="masthead"><div className="row">
        <div><h1 style={{ color: store.accent, fontSize: 18 }}>{store.name}</h1></div>
        <nav><Link href={`/${slug}`}>Back to shop</Link></nav>
      </div></div>

      {/* Each store exposes its data a different way, so the crawler needs a
          per-store strategy rather than one universal selector. */}
      {store.markup === 'jsonld' && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'Product', name: title, sku: item.sku,
          brand: { '@type': 'Brand', name: store.name },
          offers: { '@type': 'Offer', priceCurrency: 'EUR', price: (price / 100).toFixed(2),
                    availability: `https://schema.org/${availability}` },
        }) }} />
      )}

      <div className="pdp"
           {...(store.markup === 'microdata'
             ? { itemScope: true, itemType: 'https://schema.org/Product' } : {})}>
        <div className="ph">product image</div>
        <div>
          <h1 {...(store.markup === 'microdata' ? { itemProp: 'name' } : {})}>{title}</h1>

          {store.markup === 'microdata' ? (
            <div itemProp="offers" itemScope itemType="https://schema.org/Offer">
              <meta itemProp="priceCurrency" content="EUR" />
              <div className="price" itemProp="price" content={(price / 100).toFixed(2)}>
                {money(price)}
              </div>
              <link itemProp="availability" href={`https://schema.org/${availability}`} />
              <div className={`stock ${stocked ? 'in' : 'out'}`}>
                {stocked ? 'In stock' : 'Out of stock'}
              </div>
            </div>
          ) : (
            <>
              {/* The plain store gives the crawler nothing but a class name. */}
              <div className="price" data-testid="price">{money(price)}</div>
              <div className={`stock ${stocked ? 'in' : 'out'}`}>
                {stocked ? 'In stock' : 'Out of stock'}
              </div>
            </>
          )}

          <dl>
            <dt>SKU</dt><dd {...(store.markup === 'microdata' ? { itemProp: 'sku' } : {})}>{item.sku}</dd>
            <dt>Sold by</dt><dd>{store.name}</dd>
            <dt>Delivery</dt><dd>3–5 working days</dd>
          </dl>

          <button className="buy" disabled>Add to basket</button>
          <p style={{ fontSize: 12, opacity: .55, marginTop: 12 }}>
            Fictional listing. The basket does nothing.
          </p>
        </div>
      </div>
    </div>
  )
}
