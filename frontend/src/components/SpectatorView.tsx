'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useChainId, usePublicClient, useWalletClient } from 'wagmi'
import { useBattleChain } from '@/hooks/useBattleChain'
import { getGasOverrides, placeBet } from '@/utils/battlechain'
import type { BattleSummary } from '@/types/contracts'
import { toast } from '@/components/ui/toast'
import { formatWalletError } from '@/utils/walletErrors'

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
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Spectator Arena</h1>
        <p className="text-gray-400">Watch battles and place bets on your favorite agents</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Battle List */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold mb-4">Live Battles</h2>
          
          {loading ? (
            <div className="text-center text-gray-400 py-8">Loading battles...</div>
          ) : battles.filter(b => b.state === 'Active').length === 0 ? (
            <div className="text-center text-gray-400 py-8">No active battles</div>
          ) : (
            <div className="grid gap-4">
              {battles.filter(b => b.state === 'Active').map((battle) => (
                <div
                  key={battle.id}
                  onClick={() => setSelectedBattle(battle)}
                  className={`bg-gray-800 p-6 rounded-lg cursor-pointer transition ${
                    selectedBattle?.id === battle.id ? 'ring-2 ring-blue-500' : 'hover:bg-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-semibold">Battle #{battle.id}</h3>
                      <p className="text-gray-400 text-sm mt-1">
                        Entry Fee: {battle.entryFee} ETH
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-green-400 font-medium">Live</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-sm text-gray-400">
                    <span>Ends: {battle.deadline}</span>
                    <span>•</span>
                    <span>Challenge: {battle.challenge.slice(0, 10)}...</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Betting Panel */}
        <div className="bg-gray-800 p-6 rounded-lg h-fit">
          <h2 className="text-2xl font-bold mb-4">Place Bet</h2>
          
          {selectedBattle ? (
            <div>
              <div className="mb-4">
                <p className="text-gray-400 text-sm mb-2">Selected Battle</p>
                <p className="font-semibold">Battle #{selectedBattle.id}</p>
              </div>

              <div className="mb-4">
                <p className="text-gray-400 text-sm mb-2">Select Agent</p>
                <div className="space-y-2">
                  {agentsLoading ? (
                    <div className="text-sm text-gray-400">Loading agents...</div>
                  ) : agents.length === 0 ? (
                    <div className="text-sm text-gray-400">No agents registered</div>
                  ) : (
                    agents.map((agent) => (
                      <button
                        key={agent.index}
                        onClick={() => setSelectedAgent(agent.index)}
                        className={`w-full p-3 rounded-lg text-left transition ${
                          selectedAgent === agent.index
                            ? 'bg-blue-600'
                            : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-sm text-gray-400">
                          {agent.address.slice(0, 10)}...
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="mb-4">
                <p className="text-gray-400 text-sm mb-2">Bet Amount (ETH)</p>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="0.1"
                  step="0.01"
                  min="0"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={handlePlaceBet}
                disabled={!isConnected || betting || selectedAgent === null || !betAmount}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition"
              >
                {betting ? 'Placing Bet...' : isConnected ? 'Place Bet' : 'Connect to Bet'}
              </button>

              <div className="mt-4 p-4 bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-400">Potential Payout</p>
                <p className="text-xl font-bold text-green-400">
                  {betAmount ? `${(parseFloat(betAmount) * 2).toFixed(2)} ETH` : '-'} 
                </p>
                <p className="text-xs text-gray-500 mt-1">Based on current odds</p>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Select a battle to place bets
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="mt-8 bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-4">Top Performing Agents</h2>
        <div className="overflow-x-auto">
          {leaderboard.rows.length === 0 ? (
            <div className="text-sm text-gray-400 py-6">
              No resolved battles yet
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-700">
                  <th className="pb-3 text-gray-400 font-medium">Rank</th>
                  <th className="pb-3 text-gray-400 font-medium">Agent</th>
                  <th className="pb-3 text-gray-400 font-medium">Wins</th>
                  <th className="pb-3 text-gray-400 font-medium">Total Extracted</th>
                  <th className="pb-3 text-gray-400 font-medium">Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.rows.map((row, index) => (
                  <tr key={row.address} className="border-b border-gray-700">
                    <td className="py-4 font-bold text-yellow-400">
                      #{index + 1}
                    </td>
                    <td className="py-4">
                      {row.address.slice(0, 10)}...
                    </td>
                    <td className="py-4">{row.wins}</td>
                    <td className="py-4">{row.totalExtracted.toFixed(2)} ETH</td>
                    <td className="py-4 text-green-400">
                      {row.winRate.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default SpectatorView
