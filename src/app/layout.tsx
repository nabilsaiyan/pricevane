import type { Metadata } from 'next'
import { Inter, Spline_Sans_Mono } from 'next/font/google'
import './globals.css'

/**
 * Inter, with the optical-size axis.
 *
 * The reference sets body copy in InterVariable and headings in InterDisplay --
 * two cuts of one superfamily, self-hosted. Google now serves Inter v4 with the
 * `opsz` axis exposed (14-32), which is the same distinction from a single
 * file: at opsz 14-20 the letterforms are the text cut, at 28-32 they tighten
 * into the display cut. So `--fu` and `--fb` below are the same family at
 * different optical sizes rather than two downloads.
 *
 * This replaces Archivo + Geist. Archivo is an expanded grotesque and was a
 * poor UI face; Geist and Archivo together had no relationship to each other.
 */
const inter = Inter({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-inter',
  display: 'swap',
})

// The label and figure voice. Also what the reference uses for its mono.
const mono = Spline_Sans_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Pricevane — competitor prices, checked overnight',
  description:
    'Track competitor prices and catalogs every day. Pricevane matches your products to theirs, records every move, and tells you the moment someone undercuts you.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
