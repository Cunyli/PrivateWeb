// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import { getPhotoCurationVisibility } from "@/lib/photo-curation.server"
import { PhotoCurationProvider } from "@/components/photo-curation-provider"
import { Analytics } from '@vercel/analytics/react'
import { I18nProvider } from "@/lib/i18n"
import { InteractionPerformanceProbe } from "@/components/interaction-performance-probe"
import { PortfolioLandscapeHint } from "@/components/portfolio-landscape-hint"

export const metadata: Metadata = {
  title: "Lijie's Portfolio",
  description: 'Photographs and visual stories by Lijie Li.',
  icons: {
    icon: '/icon.jpeg',
    shortcut: '/icon.jpeg',
    apple: '/icon.jpeg',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const curation = await getPhotoCurationVisibility()
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head><link rel="preload" href="/fonts/hanken-variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" /></head>
      <body>
        <I18nProvider>
          <PhotoCurationProvider value={curation}>
          {children}
          <PortfolioLandscapeHint />
          <InteractionPerformanceProbe />
          </PhotoCurationProvider>
        </I18nProvider>
        <Analytics />
      </body>
    </html>
  )
}
