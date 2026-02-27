'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useChainId, usePublicClient, useWalletClient } from 'wagmi'
import { useBattleChain } from '@/hooks/useBattleChain'
import { getGasOverrides, placeBet, claimPayout } from '@/utils/battlechain'
import { formatEther } from 'viem'
import type { BattleSummary } from '@/types/contracts'
import { toast } from '@/components/ui/toast'
import { formatWalletError } from '@/utils/walletErrors'
import { cn } from '@/lib/utils'
import { AgentCardSkeleton, BattleCardSkeleton } from '@/components/ui/skeletons'
import { Heading, Label, Text } from '@/components/ui/typography'

interface Agent {
  address: string;
  name: string;
  index: number;
}

const SpectatorView: React.FC = () => {
  const {
    isConnected,
    battles,
    loading,
    fetchBattles,
    fetchBattleAgents,
    betPayoutsByBattle,
    participationByBattle,
  } = useBattleChain()
  const chainId = useChainId()
  const expectedChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID)
  const hasExpectedChainId =
    Number.isFinite(expectedChainId) && expectedChainId > 0
  const publicClient = usePublicClient({
    chainId: hasExpectedChainId ? expectedChainId : undefined,
  })
  const { data: walletClient } = useWalletClient({
    chainId: hasExpectedChainId ? expectedChainId : undefined,
  })
  const searchParams = useSearchParams()
  const [selectedBattle, setSelectedBattle] = useState<BattleSummary | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [betAmount, setBetAmount] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null)
  const [betting, setBetting] = useState(false)
  const [claimingPayout, setClaimingPayout] = useState(false)

  useEffect(() => {
    fetchBattles()
  }, [fetchBattles])

  useEffect(() => {
    const battleIdParam = searchParams.get('battleId')
    if (!battleIdParam) {
      return
    }

    const match = battles.find(
      (battle) => battle.id.toString() === battleIdParam,
    )
    if (match && match.id !== selectedBattle?.id) {
      setSelectedBattle(match)
    }
  }, [battles, searchParams, selectedBattle])

  useEffect(() => {
    if (selectedBattle) {
      // Fetch agents for selected battle
      fetchAgents(selectedBattle.address as `0x${string}`)
      setSelectedAgent(null)
    }
  }, [selectedBattle])

  const fetchAgents = async (battleAddress: `0x${string}`) => {
    setAgentsLoading(true)
    try {
      const battleAgents = await fetchBattleAgents(battleAddress)
      const summaries = battleAgents.map((address, index) => ({
        address,
        name: `Agent ${index + 1}`,
        index,
      }))
      setAgents(summaries)
    } catch (error) {
      console.error('Failed to load agents:', error)
      setAgents([])
      toast.error('Failed to load agents')
    } finally {
      setAgentsLoading(false)
    }
  }

  const handlePlaceBet = async () => {
    if (!selectedBattle || selectedAgent === null || !betAmount) return
    if (!walletClient) {
      toast.error('Connect your wallet to place a bet')
      return
    }

    const actualChainId =
      chainId ?? walletClient.chain?.id ?? publicClient?.chain?.id
    if (!actualChainId) {
      toast.error('Unable to detect wallet chain. Reconnect your wallet.')
      return
    }
    if (hasExpectedChainId && actualChainId !== expectedChainId) {
      toast.error(`Wrong network. Switch to chain ${expectedChainId}.`)
      return
    }

    setBetting(true)
    try {
      const gasOverrides = await getGasOverrides(publicClient)
      await placeBet(
        walletClient,
        selectedBattle.id,
        BigInt(selectedAgent),
        parseFloat(betAmount),
        gasOverrides,
      )
      toast.success('Bet placed successfully')
    } catch (error) {
      const message = formatWalletError(error)
      console.error('Failed to place bet:', message)
      toast.error(message)
    } finally {
      setBetting(false)
    }
  }

  const handleClaimPayout = async () => {
    if (!selectedBattle) {
      return
    }
    if (!walletClient) {
      toast.error('Connect your wallet to claim')
      return
    }

    setClaimingPayout(true)
    try {
      await claimPayout(walletClient, selectedBattle.id)
      toast.success('Payout claimed')
    } catch (error) {
      console.error('Failed to claim payout:', error)
      toast.error('Failed to claim payout')
    } finally {
      setClaimingPayout(false)
    }
  }

  const leaderboard = useMemo(() => {
    const resolvedBattles = battles.filter((battle) => battle.winner)
    const totalResolved = resolvedBattles.length
    const stats = new Map<string, { wins: number; totalExtracted: number }>()

    resolvedBattles.forEach((battle) => {
      if (!battle.winner) {
        return
      }
      const entryFee = Number(battle.entryFee)
      const current = stats.get(battle.winner) ?? { wins: 0, totalExtracted: 0 }
      stats.set(battle.winner, {
        wins: current.wins + 1,
        totalExtracted:
          current.totalExtracted + (Number.isNaN(entryFee) ? 0 : entryFee),
      })
    })

    const rows = Array.from(stats.entries())
      .map(([address, data]) => ({
        address,
        wins: data.wins,
        totalExtracted: data.totalExtracted,
        winRate: totalResolved ? (data.wins / totalResolved) * 100 : 0,
      }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 5)

    return { rows, totalResolved }
  }, [battles])

  return (
    <div className="py-10">
      <header className="mb-8 space-y-2">
        <Heading as="h1" size="h1">
          Spectator Arena
        </Heading>
        <Text tone="muted">
          Watch battles and place bets on your favorite agents.
        </Text>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <Heading as="h2" size="h2">
              Live Battles
            </Heading>
            <Text tone="muted" className="text-sm">
              {battles.filter((battle) => battle.state === 'Active').length} active
            </Text>
          </div>

          {loading ? (
            <div className="grid gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <BattleCardSkeleton key={`spectator-battle-${index}`} />
              ))}
            </div>
          ) : battles.filter((battle) => battle.state === 'Active').length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No active battles
            </div>
          ) : (
            <div className="grid gap-4">
              {battles
                .filter((battle) => battle.state === 'Active')
                .map((battle) => (
                  <button
                    key={battle.id}
                    onClick={() => setSelectedBattle(battle)}
                    className={cn(
                      'rounded-2xl border border-border bg-card p-6 text-left shadow-soft transition',
                      selectedBattle?.id === battle.id
                        ? 'border-primary/60 ring-1 ring-primary/40'
                        : 'hover:bg-muted/50',
                    )}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <Heading as="h3" size="h3" className="text-xl">
                          Battle #{battle.id}
                        </Heading>
                        <Text tone="muted" className="mt-1 text-sm">
                          Entry Fee: {battle.entryFee} ETH
                        </Text>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <Text className="text-sm text-emerald-300">Live</Text>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>Ends: {battle.deadline}</span>
                      <span>•</span>
                      <span>Challenge: {battle.challenge.slice(0, 10)}...</span>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>

        <div
          className={cn(
            'h-fit rounded-2xl border border-border bg-card p-6 shadow-card',
            selectedBattle ? 'block' : 'hidden lg:block',
          )}
        >
          <Heading as="h2" size="h2" className="mb-4">
            Place Bet
          </Heading>

          {selectedBattle ? (
            <div>
              <div className="mb-4">
                <Label>Selected battle</Label>
                <Text className="mt-2 font-semibold">Battle #{selectedBattle.id}</Text>
              </div>

              <div className="mb-4">
                <Label>Select agent</Label>
                <div className="mt-2 space-y-2">
                  {agentsLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <AgentCardSkeleton key={`agent-skeleton-${index}`} />
                      ))}
                    </div>
                  ) : agents.length === 0 ? (
                    <Text tone="muted" className="text-sm">
                      No agents registered
                    </Text>
                  ) : (
                    agents.map((agent) => (
                      <button
                        key={agent.index}
                        onClick={() => setSelectedAgent(agent.index)}
                        className={cn(
                          'w-full rounded-lg border border-border p-3 text-left transition',
                          selectedAgent === agent.index
                            ? 'border-primary/60 bg-primary/10'
                            : 'bg-background hover:bg-muted/50',
                        )}
                      >
                        <Text className="font-medium">{agent.name}</Text>
                        <Text tone="muted" className="font-mono text-xs">
                          {agent.address.slice(0, 10)}...
                        </Text>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="mb-4">
                <Label>Bet amount (ETH)</Label>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="0.1"
                  step="0.01"
                  min="0"
                  className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground focus:outline-none"
                />
              </div>

              <button
                onClick={handlePlaceBet}
                disabled={!isConnected || betting || selectedAgent === null || !betAmount}
                className="w-full rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {betting ? 'Placing Bet...' : isConnected ? 'Place Bet' : 'Connect to Bet'}
              </button>

              <div className="mt-4 rounded-lg border border-border bg-background/60 p-4">
                <Text tone="muted" className="text-sm">
                  Potential Payout
                </Text>
                <Text className="text-xl font-semibold text-emerald-300">
                  {betAmount ? `${(parseFloat(betAmount) * 2).toFixed(2)} ETH` : '-'}
                </Text>
                <Text tone="muted" className="mt-1 text-xs">
                  Based on current odds
                </Text>
              </div>

              {(() => {
                const payout =
                  betPayoutsByBattle[selectedBattle.id.toString()] ?? 0n
                const betStatus =
                  participationByBattle[selectedBattle.id.toString()]
                if (!betStatus?.asBettor) {
                  return null
                }
                if (betStatus.betClaimed) {
                  return (
                    <div className="mt-4 rounded-lg border border-emerald-600/40 bg-emerald-900/20 p-3 text-sm text-emerald-200">
                      Payout claimed for this battle.
                    </div>
                  )
                }
                if (payout === 0n) {
                  return (
                    <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-900/20 p-3 text-sm text-blue-200">
                      Your bet is registered. Payout will unlock after resolution.
                    </div>
                  )
                }
                return (
                  <div className="mt-4 rounded-lg border border-border bg-background/60 p-4">
                    <Text tone="muted" className="text-sm">
                      Claimable payout
                    </Text>
                    <Text className="text-lg font-semibold text-emerald-300">
                      {formatEther(payout)} ETH
                    </Text>
                    <button
                      onClick={handleClaimPayout}
                      disabled={!isConnected || claimingPayout}
                      className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {claimingPayout ? 'Claiming...' : 'Claim Payout'}
                    </button>
                  </div>
                )
              })()}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-background/60 p-4 text-center text-sm text-muted-foreground">
              Select a battle to place bets
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card">
        <Heading as="h2" size="h2" className="mb-4">
          Top Performing Agents
        </Heading>
        {leaderboard.rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-background/60 p-6 text-sm text-muted-foreground">
            No resolved battles yet
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-3 md:hidden">
              {leaderboard.rows.map((row, index) => (
                <div
                  key={row.address}
                  className="rounded-xl border border-border bg-background/60 p-4"
                >
                  <div className="flex items-center justify-between">
                    <Label>#{index + 1}</Label>
                    <Text tone="muted" className="text-xs">
                      {row.wins} wins
                    </Text>
                  </div>
                  <Text className="mt-2 font-mono text-sm">
                    {row.address.slice(0, 10)}...
                  </Text>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-emerald-300">
                      {row.winRate.toFixed(0)}%
                    </span>
                    <span className="text-muted-foreground">
                      {row.totalExtracted.toFixed(2)} ETH
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-border text-xs uppercase tracking-label text-muted-foreground">
                    <th className="pb-3">Rank</th>
                    <th className="pb-3">Agent</th>
                    <th className="pb-3">Wins</th>
                    <th className="pb-3">Total Extracted</th>
                    <th className="pb-3">Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.rows.map((row, index) => (
                    <tr key={row.address} className="border-b border-border text-sm">
                      <td className="py-4 font-semibold text-amber-300">
                        #{index + 1}
                      </td>
                      <td className="py-4 font-mono">
                        {row.address.slice(0, 10)}...
                      </td>
                      <td className="py-4">{row.wins}</td>
                      <td className="py-4">{row.totalExtracted.toFixed(2)} ETH</td>
                      <td className="py-4 text-emerald-300">
                        {row.winRate.toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SpectatorView
