'use client'

import React, { useMemo, useState } from 'react'
import { formatEther } from 'viem'
import { useWalletClient } from 'wagmi'
import { useBattleChain } from '@/hooks/useBattleChain'
import { claimPayout, claimPrize, withdrawPending } from '@/utils/battlechain'
import { toast } from '@/components/ui/toast'
import { Heading, Label, Text } from '@/components/ui/typography'

const BattleHistory: React.FC = () => {
  const {
    battles,
    claimablePrizesByBattle,
    betPayoutsByBattle,
    pendingWithdrawalsByBattle,
    participationByBattle,
  } = useBattleChain()
  const { data: walletClient } = useWalletClient()
  const [processing, setProcessing] = useState<string | null>(null)

  const history = useMemo(() => {
    return battles.filter((battle) => {
      const battleKey = battle.id.toString()
      const participation = participationByBattle[battleKey]
      const hasClaimable =
        (claimablePrizesByBattle[battleKey] ?? 0n) > 0n ||
        (betPayoutsByBattle[battleKey] ?? 0n) > 0n ||
        (pendingWithdrawalsByBattle[battleKey] ?? 0n) > 0n

      return (
        (battle.state === 'Resolved' || battle.state === 'Claimed') &&
        (participation?.asOwner || participation?.asBettor || hasClaimable)
      )
    })
  }, [
    battles,
    betPayoutsByBattle,
    claimablePrizesByBattle,
    participationByBattle,
    pendingWithdrawalsByBattle,
  ])

  const handleClaimPrize = async (battleId: bigint) => {
    if (!walletClient) {
      toast.error('Connect your wallet to claim')
      return
    }
    setProcessing(`prize-${battleId.toString()}`)
    try {
      await claimPrize(walletClient, battleId)
      toast.success('Prize claim submitted')
    } catch (error) {
      console.error('Prize claim failed:', error)
      toast.error('Prize claim failed')
    } finally {
      setProcessing(null)
    }
  }

  const handleClaimPayout = async (battleId: bigint) => {
    if (!walletClient) {
      toast.error('Connect your wallet to claim')
      return
    }
    setProcessing(`payout-${battleId.toString()}`)
    try {
      await claimPayout(walletClient, battleId)
      toast.success('Payout claimed')
    } catch (error) {
      console.error('Payout claim failed:', error)
      toast.error('Payout claim failed')
    } finally {
      setProcessing(null)
    }
  }

  const handleWithdraw = async (battleId: bigint, battleAddress: string) => {
    if (!walletClient) {
      toast.error('Connect your wallet to withdraw')
      return
    }
    setProcessing(`withdraw-${battleId.toString()}`)
    try {
      await withdrawPending(walletClient, battleAddress as `0x${string}`)
      toast.success('Withdrawal submitted')
    } catch (error) {
      console.error('Withdrawal failed:', error)
      toast.error('Withdrawal failed')
    } finally {
      setProcessing(null)
    }
  }

  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-soft">
        No resolved battles yet. Claims will appear once a battle finishes.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <Heading as="h2" size="h2">
        Battle History
      </Heading>
      <Text tone="muted" className="mt-2 text-sm">
        Resolved battles you participated in, with claim status.
      </Text>

      <div className="mt-6 space-y-4">
        {history.map((battle) => {
          const battleKey = battle.id.toString()
          const claimablePrize = claimablePrizesByBattle[battleKey] ?? 0n
          const betPayout = betPayoutsByBattle[battleKey] ?? 0n
          const pendingWithdrawal = pendingWithdrawalsByBattle[battleKey] ?? 0n
          const participation = participationByBattle[battleKey]

          return (
            <div
              key={battle.id}
              className="rounded-xl border border-border bg-background/60 p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <Heading as="h3" size="h3" className="text-lg">
                    Battle #{battle.id.toString()}
                  </Heading>
                  <Text tone="muted" className="text-sm">
                    Winner: {battle.winner ? `${battle.winner.slice(0, 8)}...` : 'None'}
                  </Text>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {claimablePrize > 0n ? (
                    <span className="rounded-full bg-emerald-600/20 px-3 py-1 text-emerald-200">
                      Prize claimable
                    </span>
                  ) : null}
                  {betPayout > 0n ? (
                    <span className="rounded-full bg-blue-600/20 px-3 py-1 text-blue-200">
                      Bet payout ready
                    </span>
                  ) : null}
                  {pendingWithdrawal > 0n ? (
                    <span className="rounded-full bg-purple-600/20 px-3 py-1 text-purple-200">
                      Withdrawal ready
                    </span>
                  ) : null}
                  {claimablePrize === 0n && betPayout === 0n && pendingWithdrawal === 0n ? (
                    <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                      {participation?.betClaimed ? 'Claimed' : 'No rewards'}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <Label className="text-[11px]">Prize claim</Label>
                  <p className="mt-2 text-lg font-semibold text-emerald-200">
                    {formatEther(claimablePrize)} ETH
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <Label className="text-[11px]">Bet payout</Label>
                  <p className="mt-2 text-lg font-semibold text-blue-200">
                    {formatEther(betPayout)} ETH
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <Label className="text-[11px]">Pending withdrawal</Label>
                  <p className="mt-2 text-lg font-semibold text-purple-200">
                    {formatEther(pendingWithdrawal)} ETH
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {claimablePrize > 0n ? (
                  <button
                    onClick={() => handleClaimPrize(battle.id)}
                    disabled={processing === `prize-${battle.id.toString()}`}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-600"
                  >
                    {processing === `prize-${battle.id.toString()}`
                      ? 'Claiming...'
                      : 'Claim prize'}
                  </button>
                ) : null}
                {betPayout > 0n ? (
                  <button
                    onClick={() => handleClaimPayout(battle.id)}
                    disabled={processing === `payout-${battle.id.toString()}`}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-600"
                  >
                    {processing === `payout-${battle.id.toString()}`
                      ? 'Claiming...'
                      : 'Claim payout'}
                  </button>
                ) : null}
                {pendingWithdrawal > 0n ? (
                  <button
                    onClick={() =>
                      handleWithdraw(battle.id, battle.address)
                    }
                    disabled={processing === `withdraw-${battle.id.toString()}`}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:bg-gray-600"
                  >
                    {processing === `withdraw-${battle.id.toString()}`
                      ? 'Withdrawing...'
                      : 'Withdraw'}
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default BattleHistory
