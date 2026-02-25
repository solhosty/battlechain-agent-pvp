import type { Metadata } from 'next'
import AppNav from '@/components/AppNav'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'BattleChain PvP Agent Arena',
  description: 'BattleChain PvP Agent Arena frontend',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="app-shell min-h-screen bg-gray-900 text-white">
            <AppNav />
            <main className="mx-auto w-full max-w-6xl px-4">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
