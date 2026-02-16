import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/src/components/Providers'

export const metadata: Metadata = {
  title: 'Monitoring Central',
  description: 'Real-time monitoring dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
