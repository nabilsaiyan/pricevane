import Link from 'next/link'
import { getProducts, getUsage } from '@/lib/data/queries'

export const dynamic = 'force-dynamic'

export default async function Products({ searchParams }: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const [products, usage] = await Promise.all([getProducts(q), getUsage()])

  return (
    <>
      <div className="head">
        <div>
          <h1>Products</h1>
          <p>{usage?.tracked_products ?? 0} tracked of {usage?.max_tracked_products ?? 0} on your plan.</p>
        </div>
        {/* A GET form: the search term lives in the URL, so a filtered view is
            shareable and the back button behaves. */}
        <form method="get">
          <input className="srch" type="search" name="q" defaultValue={q ?? ''}
                 placeholder="Search products…" aria-label="Search products" />
        </form>
      </div>

      <section className="card">
        <table className="t">
          <thead>
            <tr>
              <th>Product</th><th>SKU</th><th>Brand</th>
              <th style={{ textAlign: 'right' }}>Your price</th>
              <th style={{ textAlign: 'right' }}>Tracked</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td><Link href={`/app/products/${p.id}`}>{p.title}</Link></td>
                <td className="mono" style={{ fontFamily: 'var(--fm)', fontSize: 11.5 }}>{p.sku}</td>
                <td>{p.brand ?? '—'}</td>
                <td className="n">{p.our_price_cents == null ? '—' : `€${(p.our_price_cents / 100).toFixed(2)}`}</td>
                <td className="n">
                  <span className={`pill ${p.is_tracked ? 'warn' : 'ok'}`}>{p.is_tracked ? 'yes' : 'no'}</span>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={5}>
                <div className="empty">{q ? `Nothing matches “${q}”.` : 'No products yet.'}</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}
