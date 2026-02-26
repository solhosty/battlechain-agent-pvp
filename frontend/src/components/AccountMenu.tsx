'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectKitButton } from 'connectkit'
import { formatEther } from 'viem'
import { useAccount, useDisconnect } from 'wagmi'
import { useBattleChain } from '@/hooks/useBattleChain'

const AccountMenu = () => {
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { claimablePrizeTotal, claimableBetTotal, pendingWithdrawalTotal } =
    useBattleChain()

  const claimableTotal =
    claimablePrizeTotal + claimableBetTotal + pendingWithdrawalTotal
  const hasClaimable = claimableTotal > 0n
  const claimableLabel = hasClaimable
    ? `${Number(formatEther(claimableTotal)).toFixed(3)} ETH`
    : null

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  if (!address) {
    return (
      <ConnectKitButton.Custom>
        {({ show }) => (
          <button
            onClick={show}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Connect Wallet
          </button>
        )}
      </ConnectKitButton.Custom>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-muted/60"
      >
        <span className="font-mono">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        {hasClaimable ? (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-200">
            {claimableLabel}
          </span>
        ) : null}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-card p-2 shadow-card">
          <Link
            href="/dashboard"
            className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            Balance Center
            {hasClaimable ? (
              <span className="text-xs text-emerald-300">{claimableLabel}</span>
            ) : null}
          </Link>
          <button
            type="button"
            className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => {
              setOpen(false)
              disconnect()
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}

export default AccountMenu
