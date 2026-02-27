'use client'

import { useEffect, useState } from 'react'
import type { Address } from 'viem'
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi'
import { useBattleChain } from '@/hooks/useBattleChain'
import { createBattle } from '@/utils/battlechain'
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
import { Heading, Label, Text, Caption } from '@/components/ui/typography'

type CreatePhase =
  | 'idle'
  | 'awaiting_wallet'
  | 'submitted'
  | 'confirming'
  | 'timeout'
  | 'error'
  | 'success'

type CreateFormState = {
  challengeType: ChallengeType
  entryFee: string
  maxAgents: string
  durationHours: string
}

const defaultForm: CreateFormState = {
  challengeType: ChallengeType.REENTRANCY_VAULT,
  entryFee: '0.05',
  maxAgents: '4',
  durationHours: '24',
}

const quickDefaults = {
  challengeType: ChallengeType.REENTRANCY_VAULT,
  entryFee: 0.05,
  maxAgents: 4,
  durationHours: 24,
}

type CreateBattlePanelProps = {
  initialOpen?: boolean
}

const CreateBattlePanel = ({ initialOpen }: CreateBattlePanelProps) => {
  const { fetchBattles } = useBattleChain()
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
  const [createOpen, setCreateOpen] = useState(initialOpen ?? false)
  const [creating, setCreating] = useState(false)
  const [createPhase, setCreatePhase] = useState<CreatePhase>('idle')
  const [createForm, setCreateForm] = useState<CreateFormState>(defaultForm)

  useEffect(() => {
    if (initialOpen) {
      setCreateOpen(true)
    }
  }, [initialOpen])

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
    isReplacementUnderpriced(message) || isNonceTooLow(message) || isAlreadyKnown(message)

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
      address: sender as Address,
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
            address: sender as Address,
            blockTag: 'pending',
          })
        }

        await backoff(attempt)
      }
    }

    throw new Error('Failed to submit transaction after retries.')
  }

  const submitCreateBattle = async (
    challengeType: ChallengeType,
    entryFee: number,
    maxAgents: number,
    durationHours: number,
  ) => {
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
        challengeType,
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
      setCreatePhase(message.toLowerCase().includes('timeout') ? 'timeout' : 'error')
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  const handleQuickBattle = async () => {
    await submitCreateBattle(
      quickDefaults.challengeType,
      quickDefaults.entryFee,
      quickDefaults.maxAgents,
      quickDefaults.durationHours,
    )
  }

  const handleCustomizeBattle = async () => {
    const entryFee = Number.parseFloat(createForm.entryFee)
    const maxAgents = Number.parseInt(createForm.maxAgents, 10)
    const durationHours = Number.parseFloat(createForm.durationHours)

    await submitCreateBattle(
      createForm.challengeType,
      entryFee,
      maxAgents,
      durationHours,
    )
  }

  const phaseMessage =
    createPhase === 'awaiting_wallet'
      ? 'Awaiting wallet confirmation...'
      : createPhase === 'submitted'
      ? 'Battle submitted. Waiting for confirmation...'
      : createPhase === 'confirming'
      ? 'Confirming on-chain...'
      : createPhase === 'timeout'
      ? 'RPC timeout — try again.'
      : createPhase === 'success'
      ? 'Battle confirmed.'
      : createPhase === 'error'
      ? 'Battle creation failed. Review wallet error.'
      : null

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="space-y-2">
        <Heading size="h2" as="h2">
          Create Battle
        </Heading>
        <Text tone="muted">
          Launch a new arena with default parameters or customize the rules.
        </Text>
      </div>

      <div className="rounded-xl border border-border bg-background/50 p-2.5">
        <Label>Quick defaults</Label>
        <div className="mt-2 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-2">
            <span className="font-medium text-foreground">Challenge</span>
            <span>Reentrancy Vault</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-2">
            <span className="font-medium text-foreground">Entry fee</span>
            <span>{quickDefaults.entryFee} ETH</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-2">
            <span className="font-medium text-foreground">Max agents</span>
            <span>{quickDefaults.maxAgents}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-2">
            <span className="font-medium text-foreground">Duration</span>
            <span>{quickDefaults.durationHours} hours</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-3">
        <button
          type="button"
          onClick={handleQuickBattle}
          disabled={creating}
          className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-60"
        >
          {creating && createPhase !== 'idle' ? 'Creating...' : 'Quick Battle'}
        </button>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
        >
          Customize
        </button>
      </div>

      {phaseMessage ? <Caption className="text-sm">{phaseMessage}</Caption> : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent variant="sheet" className="overflow-y-auto p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>Customize battle</DialogTitle>
            <DialogDescription>
              Tune entry fee, max agents, and duration before deployment.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label as="label">Challenge type</Label>
              <select
                value={createForm.challengeType}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    challengeType: Number(event.target.value) as ChallengeType,
                  }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
              >
                <option value={ChallengeType.REENTRANCY_VAULT}>
                  Reentrancy Vault
                </option>
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label as="label">Entry fee (ETH)</Label>
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
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <Label as="label">Max agents</Label>
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
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <Label as="label">Duration (hours)</Label>
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
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCustomizeBattle}
              disabled={creating}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {createPhase === 'awaiting_wallet'
                ? 'Awaiting wallet...'
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

export default CreateBattlePanel
