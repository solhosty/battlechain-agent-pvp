'use client'

import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { formatEther } from 'viem'
import { useAccount } from 'wagmi'
import { useBattleChain } from '@/hooks/useBattleChain'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/dashboard', label: 'Balance' },
  { to: '/studio', label: 'Studio' },
  { to: '/spectate', label: 'Spectate' },
]

const AppNav = () => {
  const { address } = useAccount()
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const { claimablePrizeTotal, claimableBetTotal, pendingWithdrawalTotal } =
    useBattleChain()

  const claimableTotal =
    claimablePrizeTotal + claimableBetTotal + pendingWithdrawalTotal
  const hasClaimable = claimableTotal > 0n
  const claimableLabel = hasClaimable
    ? `${Number(formatEther(claimableTotal)).toFixed(3)} ETH`
    : null

  const linkClass = (isActive: boolean) => {
    const base =
      'inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors '
    const active = 'bg-muted text-foreground'
    const inactive =
      'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
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
            {navItems.map((item) => (
              <Link
                key={item.to}
                href={item.to}
                className={linkClass(pathname === item.to)}
              >
                <span className="inline-flex items-center gap-2">
                  {item.label}
                  {item.to === '/dashboard' && hasClaimable ? (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                      {claimableLabel}
                    </span>
                  ) : null}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button
                onClick={show}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                {address
                  ? `${address.slice(0, 6)}...${address.slice(-4)}`
                  : 'Connect Wallet'}
              </button>
            )}
          </ConnectKitButton.Custom>
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
            {navItems.map((item) => (
              <Link
                key={item.to}
                href={item.to}
                className={linkClass(pathname === item.to)}
                onClick={() => setMenuOpen(false)}
              >
                <span className="inline-flex items-center gap-2">
                  {item.label}
                  {item.to === '/dashboard' && hasClaimable ? (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                      {claimableLabel}
                    </span>
                  ) : null}
                </span>
              </Link>
            ))}
          </div>
          <div className="pt-4">
            <ConnectKitButton.Custom>
              {({ show }) => (
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    show()
                  }}
                  className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                >
                  {address
                    ? `${address.slice(0, 6)}...${address.slice(-4)}`
                    : 'Connect Wallet'}
                </button>
              )}
            </ConnectKitButton.Custom>
          </div>
        </div>
      )}
    </nav>
  )
}

export default AppNav
