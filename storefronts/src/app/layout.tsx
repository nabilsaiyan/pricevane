import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pricevane demo storefronts',
  description: 'Fictional shops built as crawl targets for Pricevane. Nothing here is for sale.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body>
      {children}
      <div className="disclaimer">
        Fictional storefront, built as a crawl target for{' '}
        <a href="https://nabilamhaouch.dev">Pricevane</a>. Nothing here is for sale.
      </div>
    </body></html>
  )
}
