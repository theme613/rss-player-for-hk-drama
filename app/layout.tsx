import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RSS Video Player',
  description: 'Watch videos from RSS feeds',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
