'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AccountMenu from '@/components/AccountMenu'

const primaryNav = [
  { to: '/', label: 'Home' },
  { to: '/arena', label: 'Arena' },
  { to: '/spectate', label: 'Spectate' },
]

const AppNav = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  const linkClass = (isActive: boolean) => {
    const base =
      'inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors '
    const active = 'bg-muted text-foreground shadow-soft'
    const inactive =
      'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
    return `${base}${isActive ? active : inactive}`
  }

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-lg font-semibold text-foreground"
            onClick={() => setMenuOpen(false)}
          >
            BattleChain
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {primaryNav.map((item) => (
              <Link
                key={item.to}
                href={item.to}
                className={linkClass(pathname === item.to)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <AccountMenu />
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-border bg-muted px-3 py-2 text-foreground transition-colors hover:bg-muted/70 md:hidden"
          aria-label="Toggle navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <div className="flex flex-col gap-1">
            <span className="block h-0.5 w-5 bg-foreground" />
            <span className="block h-0.5 w-5 bg-foreground" />
            <span className="block h-0.5 w-5 bg-foreground" />
          </div>
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-border bg-background px-4 pb-4 md:hidden">
          <div className="flex flex-col gap-2 pt-3">
            {primaryNav.map((item) => (
              <Link
                key={item.to}
                href={item.to}
                className={linkClass(pathname === item.to)}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="pt-4">
            <AccountMenu />
          </div>
        </div>
      )}
    </nav>
  )
}

export default AppNav
