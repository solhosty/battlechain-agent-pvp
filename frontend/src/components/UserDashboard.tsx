'use client'

import React from 'react'
import { formatEther } from 'viem'
import { useAccount } from 'wagmi'
import { useBattleChain } from '@/hooks/useBattleChain'
import BattleHistory from '@/components/BattleHistory'

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
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Balance Center</h1>
        <p className="text-gray-400">
          Track claimable rewards and pull payouts on your schedule.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-xl">
          <p className="text-sm uppercase tracking-wide text-gray-400">
            Claimable Prize
          </p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">
            {formatEther(claimablePrizeTotal)} ETH
          </p>
          <p className="mt-1 text-xs text-gray-500">Winner allocations awaiting claim.</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 shadow-xl">
          <p className="text-sm uppercase tracking-wide text-gray-400">
            Bet Payouts
          </p>
          <p className="mt-2 text-3xl font-semibold text-blue-300">
            {formatEther(claimableBetTotal)} ETH
          </p>
          <p className="mt-1 text-xs text-gray-500">Spectator wins ready to withdraw.</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 p-6 shadow-xl">
          <p className="text-sm uppercase tracking-wide text-gray-400">
            Pending Withdrawals
          </p>
          <p className="mt-2 text-3xl font-semibold text-purple-300">
            {formatEther(pendingWithdrawalTotal)} ETH
          </p>
          <p className="mt-1 text-xs text-gray-500">Pull payments queued for release.</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-100">Wallet Overview</h2>
            <p className="text-sm text-gray-400">
              {isConnected && address
                ? `Connected as ${address.slice(0, 6)}...${address.slice(-4)}`
                : 'Connect your wallet to unlock claims.'}
            </p>
          </div>
          <div className="rounded-full bg-gray-800 px-4 py-2 text-sm text-gray-300">
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
