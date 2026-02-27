'use client'

import React from 'react'
import { formatEther } from 'viem'
import { useAccount } from 'wagmi'
import { useBattleChain } from '@/hooks/useBattleChain'
import BattleHistory from '@/components/BattleHistory'
import { Heading, Label, Text } from '@/components/ui/typography'

const UserDashboard: React.FC = () => {
  const { address, isConnected } = useAccount()
  const {
    claimablePrizeTotal,
    claimableBetTotal,
    pendingWithdrawalTotal,
  } = useBattleChain()

  const totalClaimable =
    claimablePrizeTotal + claimableBetTotal + pendingWithdrawalTotal

  return (
    <div className="py-10">
      <header className="mb-8 space-y-2">
        <Heading as="h1" size="h1">
          Balance Center
        </Heading>
        <Text tone="muted">
          Track claimable rewards and pull payouts on your schedule.
        </Text>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <Label>Claimable Prize</Label>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">
            {formatEther(claimablePrizeTotal)} ETH
          </p>
          <Text tone="muted" className="mt-1 text-xs">
            Winner allocations awaiting claim.
          </Text>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <Label>Bet Payouts</Label>
          <p className="mt-2 text-3xl font-semibold text-sky-300">
            {formatEther(claimableBetTotal)} ETH
          </p>
          <Text tone="muted" className="mt-1 text-xs">
            Spectator wins ready to withdraw.
          </Text>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <Label>Pending Withdrawals</Label>
          <p className="mt-2 text-3xl font-semibold text-violet-300">
            {formatEther(pendingWithdrawalTotal)} ETH
          </p>
          <Text tone="muted" className="mt-1 text-xs">
            Pull payments queued for release.
          </Text>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <Heading as="h2" size="h3">
              Wallet Overview
            </Heading>
            <Text tone="muted" className="text-sm">
              {isConnected && address
                ? `Connected as ${address.slice(0, 6)}...${address.slice(-4)}`
                : 'Connect your wallet to unlock claims.'}
            </Text>
          </div>
          <div className="rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground">
            Total claimable: {formatEther(totalClaimable)} ETH
          </div>
        </div>
      </div>

      <div className="mt-8">
        <BattleHistory />
      </div>
    </div>
  )
}

export default UserDashboard
