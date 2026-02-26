'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatEther } from 'viem'
import type { Address } from 'viem'
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi'
import { useBattleChain } from '@/hooks/useBattleChain'
import {
  createBattle,
  claimPrize,
  discoverAgentsByOwner,
  getGasOverrides,
  loadSavedAgents,
  mergeSavedAgents,
  persistSavedAgents,
  registerAgent,
} from '@/utils/battlechain'
import { ChallengeType } from '@/types/contracts'
import { toast } from '@/components/ui/toast'
import { formatWalletError } from '@/utils/walletErrors'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type CreatePhase =
  | 'idle'
  | 'awaiting_wallet'
  | 'submitted'
  | 'confirming'
  | 'timeout'
  | 'error'
  | 'success'

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
  const rpcUrl = process.env.NEXT_PUBLIC_BATTLECHAIN_RPC_URL
  const router = useRouter()
  const [savedAgents, setSavedAgents] = useState<Address[]>([])
  const [savedAgentsLoaded, setSavedAgentsLoaded] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Address | ''>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createPhase, setCreatePhase] = useState<CreatePhase>('idle')
  const [createForm, setCreateForm] = useState({
    challengeType: ChallengeType.REENTRANCY_VAULT,
    entryFee: '0.05',
    maxAgents: '4',
    durationHours: '24',
  })
  const [claimingBattle, setClaimingBattle] = useState<bigint | null>(null)

  const waitForReceiptWithTimeout = async (hash: `0x${string}`) => {
    if (!publicClient) {
      throw new Error(
        'RPC unavailable. Check NEXT_PUBLIC_BATTLECHAIN_RPC_URL in frontend env config.',
      )
    }

    try {
      return await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 120_000,
        pollingInterval: 2_000,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.toLowerCase().includes('timeout')) {
        throw new Error('RPC timeout — try again')
      }
      throw error
    }
  }

  const gasBufferSteps = [120n, 130n, 150n]

  const applyGasBuffer = (gasPrice: bigint, buffer: bigint) =>
    (gasPrice * buffer) / 100n

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : String(error)

  const isReplacementUnderpriced = (message: string) =>
    message.includes('insufficient gas price to replace existing transaction') ||
    message.includes('replacement transaction underpriced')

  const isNonceTooLow = (message: string) => message.includes('nonce too low')

  const isAlreadyKnown = (message: string) => message.includes('already known')

  const shouldRetryTx = (message: string) =>
    isReplacementUnderpriced(message) ||
    isNonceTooLow(message) ||
    isAlreadyKnown(message)

  const shouldRefreshNonce = (message: string) => isNonceTooLow(message)

  const backoff = async (attempt: number) => {
    const delay = 500 * 2 ** attempt
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  const sendCreateBattleWithRetry = async (
    challengeType: ChallengeType,
    entryFee: number,
    maxAgents: number,
    durationSeconds: number,
  ) => {
    if (!publicClient) {
      throw new Error(
        'RPC unavailable. Check NEXT_PUBLIC_BATTLECHAIN_RPC_URL in frontend env config.',
      )
    }

    if (!walletClient) {
      throw new Error('Wallet client unavailable. Reconnect wallet and try again.')
    }

    const sender = account ?? walletClient.account?.address
    if (!sender) {
      throw new Error('Wallet account unavailable. Reconnect wallet and try again.')
    }

    let nonce = await publicClient.getTransactionCount({
      address: sender,
      blockTag: 'pending',
    })

    for (let attempt = 0; attempt < gasBufferSteps.length; attempt += 1) {
      const gasPrice = await publicClient.getGasPrice()
      const overrides = {
        gasPrice: applyGasBuffer(gasPrice, gasBufferSteps[attempt]),
        nonce,
      }

      try {
        return await createBattle(
          walletClient,
          challengeType,
          entryFee,
          maxAgents,
          durationSeconds,
          overrides,
        )
      } catch (error) {
        const message = getErrorMessage(error).toLowerCase()
        if (!shouldRetryTx(message) || attempt === gasBufferSteps.length - 1) {
          throw error
        }

        if (shouldRefreshNonce(message)) {
          nonce = await publicClient.getTransactionCount({
            address: sender,
            blockTag: 'pending',
          })
        }

        await backoff(attempt)
      }
    }

    throw new Error('Failed to submit transaction after retries.')
  }

  useEffect(() => {
    fetchBattles()
  }, [fetchBattles])

  useEffect(() => {
    if (selectedAgent && !savedAgents.includes(selectedAgent as Address)) {
      setSelectedAgent('')
    }
  }, [savedAgents, selectedAgent])

  useEffect(() => {
    const refreshAgents = () => {
      setSavedAgents(loadSavedAgents())
      setSavedAgentsLoaded(true)
    }

    refreshAgents()
    window.addEventListener('focus', refreshAgents)
    window.addEventListener('storage', refreshAgents)

    return () => {
      window.removeEventListener('focus', refreshAgents)
      window.removeEventListener('storage', refreshAgents)
    }
  }, [])

  useEffect(() => {
    if (!isConnected || !account) {
      return
    }

    if (!publicClient) {
      console.error('Agent discovery skipped: missing public client', {
        account,
      })
      return
    }

    if (!savedAgentsLoaded) {
      return
    }

    console.info('[AgentDiscovery] start', {
      account,
      isConnected,
      chainId: publicClient?.chain?.id,
    })

    let active = true

    discoverAgentsByOwner(publicClient, account)
      .then((found) => {
        const merged = mergeSavedAgents(savedAgents, found)
        persistSavedAgents(merged)
        console.info('[AgentDiscovery] complete', {
          saved: savedAgents.length,
          discovered: found.length,
          merged: merged.length,
        })
        if (active) {
          setSavedAgents(merged)
        }
      })
      .catch((error) => console.error('Agent discovery failed', error))

    return () => {
      active = false
    }
  }, [account, isConnected, publicClient, savedAgents, savedAgentsLoaded])

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

  const handleCreateBattle = async () => {
    if (!hasExpectedChainId) {
      toast.error('Missing NEXT_PUBLIC_CHAIN_ID in frontend env config')
      setCreatePhase('error')
      return
    }

    if (!rpcUrl) {
      toast.error('Missing NEXT_PUBLIC_BATTLECHAIN_RPC_URL in frontend env config')
      setCreatePhase('error')
      return
    }

    if (!publicClient) {
      toast.error(
        'RPC unavailable. Check NEXT_PUBLIC_BATTLECHAIN_RPC_URL in frontend env config.',
      )
      setCreatePhase('error')
      return
    }

    if (!walletClient) {
      toast.error('Connect your wallet to create a battle')
      setCreatePhase('error')
      return
    }

    const actualChainId =
      chainId ?? walletClient.chain?.id ?? publicClient.chain?.id
    if (!actualChainId) {
      toast.error('Unable to detect wallet chain. Reconnect your wallet.')
      setCreatePhase('error')
      return
    }
    if (actualChainId !== expectedChainId) {
      toast.error(`Wrong network. Switch to chain ${expectedChainId}.`)
      setCreatePhase('error')
      return
    }

    const entryFee = Number.parseFloat(createForm.entryFee)
    const maxAgents = Number.parseInt(createForm.maxAgents, 10)
    const durationHours = Number.parseFloat(createForm.durationHours)

    if (!Number.isFinite(entryFee) || entryFee <= 0) {
      toast.error('Enter a valid entry fee')
      return
    }

    if (!Number.isFinite(maxAgents) || maxAgents < 2) {
      toast.error('Enter a valid max agents value (min 2)')
      return
    }

    if (!Number.isFinite(durationHours) || durationHours <= 0) {
      toast.error('Enter a valid duration in hours')
      return
    }

    const durationSeconds = Math.round(durationHours * 3600)
    setCreating(true)
    setCreatePhase('awaiting_wallet')

    try {
      const hash = await sendCreateBattleWithRetry(
        createForm.challengeType,
        entryFee,
        maxAgents,
        durationSeconds,
      )
      setCreatePhase('submitted')
      toast('Battle submitted. Waiting for confirmation...')
      setCreatePhase('confirming')
      await waitForReceiptWithTimeout(hash)
      setCreatePhase('success')
      toast.success('Battle created')
      setCreateOpen(false)
      fetchBattles()
    } catch (error) {
      const message = formatWalletError(error)
      console.error('Failed to create battle:', message)
      setCreatePhase(
        message.toLowerCase().includes('timeout') ? 'timeout' : 'error',
      )
      toast.error(message)
    } finally {
      setCreating(false)
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
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">BattleChain Arena</h1>
        <p className="text-gray-400">PvP Agent Battle Platform</p>
      </header>

      <div className="bg-gray-800 p-6 rounded-lg mb-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Saved agents</h2>
            {savedAgents.length === 0 ? (
              <p className="text-sm text-gray-400">
                Deploy an agent in Studio to enable quick assignment.
              </p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={selectedAgent}
                  onChange={(event) =>
                    setSelectedAgent(event.target.value as Address | '')
                  }
                  className="w-full max-w-lg rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select a saved agent</option>
                  {savedAgents.map((agent) => (
                    <option key={agent} value={agent}>
                      {agent}
                    </option>
                  ))}
                </select>
                {selectedAgent && (
                  <span className="text-xs text-gray-400">
                    Selected: {selectedAgent.slice(0, 10)}...
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Create Battle
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Active Battles</h3>
          <p className="text-3xl font-bold text-green-400">
            {battles.filter(b => b.state === 'Active').length}
          </p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Total Battles</h3>
          <p className="text-3xl font-bold text-blue-400">{battles.length}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Your Battles</h3>
          <p className="text-3xl font-bold text-purple-400">
            {creatorBattleIds.length}
          </p>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold">Live Battles</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading battles...</div>
        ) : battles.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No battles found</div>
        ) : (
          <div className="divide-y divide-gray-700">
            {battles.map((battle) => (
              
              <div key={battle.id} className="p-6 hover:bg-gray-700 transition">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-semibold mb-1">
                      Battle #{battle.id}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Challenge: {battle.challenge.slice(0, 10)}...
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      battle.state === 'Active' ? 'bg-green-600' :
                      battle.state === 'Resolved' ? 'bg-blue-600' :
                      'bg-gray-600'
                    }`}>
                      {battle.state}
                    </span>
                    <p className="text-gray-400 text-sm mt-1">
                      Entry: {battle.entryFee} ETH
                    </p>
                  </div>
                </div>
                {claimablePrizesByBattle[battle.id.toString()] ? (
                  <div className="mt-4 rounded-lg bg-gray-900/60 p-3 text-sm text-emerald-200">
                    Claimable prize:{' '}
                    {formatEther(
                      claimablePrizesByBattle[battle.id.toString()],
                    )}{' '}
                    ETH
                  </div>
                ) : null}
                <div className="mt-4 flex gap-4">
                  <button
                    onClick={() => handleViewDetails(battle.id)}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm"
                  >
                    View Details
                  </button>
                  {battle.state === 'Pending' && (
                    <button
                      disabled={!isConnected}
                      onClick={() => handleAssignAgent(battle.id)}
                      className={`px-4 py-2 rounded text-sm ${
                        isConnected && selectedAgent
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-gray-600 cursor-not-allowed'
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
                      className={`px-4 py-2 rounded text-sm ${
                        isConnected
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-gray-600 cursor-not-allowed'
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create battle</DialogTitle>
            <DialogDescription>
              Configure the battle parameters before deploying on-chain.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-200">
                Challenge type
              </label>
              <select
                value={createForm.challengeType}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    challengeType: Number(event.target.value) as ChallengeType,
                  }))
                }
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
              >
                <option value={ChallengeType.REENTRANCY_VAULT}>
                  Reentrancy Vault
                </option>
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-200">
                  Entry fee (ETH)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={createForm.entryFee}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      entryFee: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-200">
                  Max agents
                </label>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={createForm.maxAgents}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      maxAgents: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-200">
                  Duration (hours)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={createForm.durationHours}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      durationHours: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:border-gray-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateBattle}
              disabled={creating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-600"
            >
              {createPhase === 'awaiting_wallet'
                ? 'Awaiting wallet confirmation...'
                : createPhase === 'confirming'
                ? 'Confirming on-chain...'
                : creating
                ? 'Creating...'
                : 'Create battle'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    <div className="py-10 text-gray-400">Loading dashboard...</div>
  )
}

export default Dashboard
