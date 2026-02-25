import React, { useEffect, useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useWalletClient } from 'wagmi'
import { useBattleChain } from '../hooks/useBattleChain'
import { placeBet } from '../utils/battlechain'
import type { BattleSummary } from '../types/contracts'

interface Agent {
  address: string;
  name: string;
  index: number;
}

const SpectatorView: React.FC = () => {
  const { account, isConnected, battles, loading } = useBattleChain()
  const { data: walletClient } = useWalletClient()
  const [selectedBattle, setSelectedBattle] = useState<BattleSummary | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [betAmount, setBetAmount] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null)
  const [betting, setBetting] = useState(false)

  useEffect(() => {
    if (selectedBattle) {
      // Fetch agents for selected battle
      fetchAgents(selectedBattle.id)
    }
  }, [selectedBattle])

  const fetchAgents = async (_battleId: bigint) => {
    // In production, fetch from contract
    // Mock data for now
    setAgents([
      { address: '0x...', name: 'Agent 1', index: 0 },
      { address: '0x...', name: 'Agent 2', index: 1 },
    ])
  }

  const handlePlaceBet = async () => {
    if (!selectedBattle || selectedAgent === null || !betAmount) return
    if (!walletClient) {
      alert('Connect your wallet to place a bet')
      return
    }

    setBetting(true)
    try {
      await placeBet(
        walletClient,
        selectedBattle.id,
        BigInt(selectedAgent),
        parseFloat(betAmount),
      )
      alert('Bet placed successfully!')
    } catch (error) {
      console.error('Failed to place bet:', error)
      alert('Failed to place bet')
    } finally {
      setBetting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">Spectator Arena</h1>
          <p className="text-gray-400">Watch battles and place bets on your favorite agents</p>
        </div>
        <ConnectKitButton.Custom>
          {({ show }) => (
            <button
              onClick={show}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold"
            >
              {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
            </button>
          )}
        </ConnectKitButton.Custom>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Battle List */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold mb-4">Live Battles</h2>
          
          {loading ? (
            <div className="text-center text-gray-400 py-8">Loading battles...</div>
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
                  {agents.map((agent) => (
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
                      <p className="text-sm text-gray-400">{agent.address.slice(0, 10)}...</p>
                    </button>
                  ))}
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
              <tr className="border-b border-gray-700">
                <td className="py-4 font-bold text-yellow-400">#1</td>
                <td className="py-4">ReentrancyMaster</td>
                <td className="py-4">12</td>
                <td className="py-4">45.5 ETH</td>
                <td className="py-4 text-green-400">85%</td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="py-4 font-bold text-gray-400">#2</td>
                <td className="py-4">FlashLoanHunter</td>
                <td className="py-4">8</td>
                <td className="py-4">32.1 ETH</td>
                <td className="py-4 text-green-400">72%</td>
              </tr>
              <tr>
                <td className="py-4 font-bold text-orange-400">#3</td>
                <td className="py-4">OverflowAttacker</td>
                <td className="py-4">6</td>
                <td className="py-4">18.9 ETH</td>
                <td className="py-4 text-yellow-400">60%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default SpectatorView
