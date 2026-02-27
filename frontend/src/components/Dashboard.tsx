'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatEther } from 'viem'
import type { Address } from 'viem'
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi'
import { useBattleChain } from '@/hooks/useBattleChain'
import {
  claimPrize,
  getAgentsByOwner,
  getGasOverrides,
  registerAgent,
} from '@/utils/battlechain'
import { toast } from '@/components/ui/toast'
import { formatWalletError } from '@/utils/walletErrors'
import { Heading, Label, Text } from '@/components/ui/typography'
import { BattleCardSkeleton } from '@/components/ui/skeletons'

const DashboardContent: React.FC = () => {
  const {
    isConnected,
    battles,
    loading,
    fetchBattles,
    creatorBattleIds,
    claimablePrizesByBattle,
  } = useBattleChain()
  const { address: account } = useAccount()
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
  const router = useRouter()
  const [savedAgents, setSavedAgents] = useState<Address[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Address | ''>('')
  const [claimingBattle, setClaimingBattle] = useState<bigint | null>(null)

  useEffect(() => {
    fetchBattles()
  }, [fetchBattles])

  useEffect(() => {
    if (selectedAgent && !savedAgents.includes(selectedAgent as Address)) {
      setSelectedAgent('')
    }
  }, [savedAgents, selectedAgent])

  const refreshAgents = useCallback(async () => {
    if (!publicClient || !account) {
      return
    }

    try {
      const agents = await getAgentsByOwner(publicClient, account)
      setSavedAgents(agents)
    } catch (error) {
      console.error('Failed to refresh agents:', error)
    }
  }, [account, publicClient])

  useEffect(() => {
    if (!isConnected || !account || !publicClient) {
      setSavedAgents([])
      return
    }

    refreshAgents()
  }, [account, isConnected, publicClient, refreshAgents])

  useEffect(() => {
    const handleFocus = () => {
      refreshAgents()
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [refreshAgents])

  const handleAssignAgent = async (battleId: bigint) => {
    if (!walletClient) {
      toast.error('Connect your wallet to assign an agent')
      return
    }

    if (!selectedAgent) {
      toast.error('Select a saved agent to assign')
      return
    }

    try {
      const actualChainId =
        chainId ?? walletClient.chain?.id ?? publicClient?.chain?.id
      if (!actualChainId) {
        toast.error('Unable to detect wallet chain. Reconnect your wallet.')
        return
      }
      if (actualChainId !== expectedChainId) {
        toast.error(`Wrong network. Switch to chain ${expectedChainId}.`)
        return
      }

      const gasOverrides = await getGasOverrides(publicClient)
      await registerAgent(
        walletClient,
        battleId,
        selectedAgent as Address,
        gasOverrides,
      )
      toast.success('Agent registered for battle')
      fetchBattles()
    } catch (error) {
      const message = formatWalletError(error)
      console.error('Failed to assign agent:', message)
      toast.error(message)
    }
  }

  const handleClaimPrize = async (battleId: bigint) => {
    if (!walletClient) {
      toast.error('Connect your wallet to claim')
      return
    }

    setClaimingBattle(battleId)
    try {
      await claimPrize(walletClient, battleId)
      toast.success('Prize claim submitted')
      fetchBattles()
    } catch (error) {
      console.error('Failed to claim prize:', error)
      toast.error('Failed to claim prize')
    } finally {
      setClaimingBattle(null)
    }
  }

  const handleViewDetails = (battleId: bigint) => {
    router.push(`/spectate?battleId=${battleId.toString()}`)
  }

  return (
    <div className="py-10">
      <header className="mb-8 space-y-2">
        <Heading as="h1" size="h1">
          BattleChain Arena
        </Heading>
        <Text tone="muted">PvP Agent Battle Platform</Text>
      </header>

      <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Label>Saved agents</Label>
            {savedAgents.length === 0 ? (
              <Text tone="muted" className="text-sm">
                Deploy an agent in Studio to enable quick assignment.
              </Text>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={selectedAgent}
                  onChange={(event) =>
                    setSelectedAgent(event.target.value as Address | '')
                  }
                  className="w-full max-w-lg rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
                >
                  <option value="">Select a saved agent</option>
                  {savedAgents.map((agent) => (
                    <option key={agent} value={agent}>
                      {agent}
                    </option>
                  ))}
                </select>
                {selectedAgent && (
                  <span className="text-xs font-mono text-muted-foreground">
                    Selected: {selectedAgent.slice(0, 10)}...
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/arena"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90"
            >
              Go to Arena
            </Link>
            <Link
              href="/arena?create=1"
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              Quick Battle
            </Link>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <Label>Active battles</Label>
          <p className="mt-3 text-3xl font-semibold text-emerald-300">
            {battles.filter((battle) => battle.state === 'Active').length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <Label>Total battles</Label>
          <p className="mt-3 text-3xl font-semibold text-sky-300">
            {battles.length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <Label>Your battles</Label>
          <p className="mt-3 text-3xl font-semibold text-violet-300">
            {creatorBattleIds.length}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="border-b border-border p-6">
          <Heading as="h2" size="h2">
            Live Battles
          </Heading>
          <Text tone="muted" className="mt-1 text-sm">
            Assign agents or claim prizes from resolved matches.
          </Text>
        </div>

        {loading ? (
          <div className="grid gap-4 p-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <BattleCardSkeleton key={`battle-skeleton-${index}`} />
            ))}
          </div>
        ) : battles.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No battles found
          </div>
        ) : (
          <div className="divide-y divide-border">
            {battles.map((battle) => (
              <div key={battle.id} className="p-6 transition hover:bg-muted/30">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Heading as="h3" size="h3" className="text-xl">
                      Battle #{battle.id}
                    </Heading>
                    <Text tone="muted" className="text-sm">
                      Challenge: {battle.challenge.slice(0, 10)}...
                    </Text>
                  </div>
                  <div className="text-left sm:text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        battle.state === 'Active'
                          ? 'bg-emerald-500/20 text-emerald-200'
                          : battle.state === 'Resolved'
                          ? 'bg-sky-500/20 text-sky-200'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {battle.state}
                    </span>
                    <Text tone="muted" className="mt-1 text-sm">
                      Entry: {battle.entryFee} ETH
                    </Text>
                  </div>
                </div>
                {claimablePrizesByBattle[battle.id.toString()] ? (
                  <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-900/20 p-3 text-sm text-emerald-100">
                    Claimable prize:{' '}
                    {formatEther(
                      claimablePrizesByBattle[battle.id.toString()],
                    )}{' '}
                    ETH
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => handleViewDetails(battle.id)}
                    className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
                  >
                    View Details
                  </button>
                  {battle.state === 'Pending' && (
                    <button
                      disabled={!isConnected}
                      onClick={() => handleAssignAgent(battle.id)}
                      className={`rounded-md px-4 py-2 text-sm font-semibold ${
                        isConnected && selectedAgent
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {!isConnected
                        ? 'Connect to Assign'
                        : selectedAgent
                        ? 'Assign to Battle'
                        : 'Select Agent'}
                    </button>
                  )}
                  {claimablePrizesByBattle[battle.id.toString()] ? (
                    <button
                      disabled={!isConnected || claimingBattle === battle.id}
                      onClick={() => handleClaimPrize(battle.id)}
                      className={`rounded-md px-4 py-2 text-sm font-semibold ${
                        isConnected
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {claimingBattle === battle.id
                        ? 'Claiming...'
                        : 'Claim Prize'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const Dashboard: React.FC = () => {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  return isMounted ? (
    <DashboardContent />
  ) : (
    <div className="py-10 text-sm text-muted-foreground">Loading dashboard...</div>
  )
}

export default Dashboard
