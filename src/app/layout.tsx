import type { Metadata } from 'next'
import { Archivo, Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

// Archivo carries a real width axis (62–125). The display voice is the same
// family at wdth 125 rather than a second typeface — hierarchy from width.
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap',
})

// The UI face. Archivo carries a width axis and is a display type; setting
// body copy, navigation and buttons in it was a real mistake -- an expanded
// grotesque is exhausting below about 20px. Archivo now does headings only.
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
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
    <html lang="en" className={`${archivo.variable} ${geist.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
