'use client'

import React, { useState } from 'react'
import type { Abi, Address } from 'viem'
import { useAccount, useChainId } from 'wagmi'
import { useAgentDeploy } from '@/hooks/useAgentDeploy'
import { toast } from '@/components/ui/toast'
import { Caption, Heading, Label, Text } from '@/components/ui/typography'

type AgentStudioProps = {
  compact?: boolean
}

const AgentStudio: React.FC<AgentStudioProps> = ({ compact = false }) => {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const expectedChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID)
  const hasExpectedChainId = Number.isFinite(expectedChainId) && expectedChainId > 0
  const rpcUrl = process.env.NEXT_PUBLIC_BATTLECHAIN_RPC_URL
  const walletConnectProjectId =
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
  const missingWalletConnectProjectId = !walletConnectProjectId
  const missingRpc = !rpcUrl
  const wrongNetwork =
    hasExpectedChainId && typeof chainId === 'number' && chainId !== expectedChainId
  const missingChainConfig = !hasExpectedChainId
  const [prompt, setPrompt] = useState('')
  const [battleId, setBattleId] = useState('')
  const {
    generating,
    deploying,
    generatedCode,
    compilationStatus,
    compiledArtifact,
    deployedAddress,
    registering,
    registrationHash,
    error,
    walletStatus,
    deployPhase,
    registerPhase,
    generateAgent,
    compileAgent,
    deployAgent,
    registerAgentForBattle,
    savedAgents,
    removeSavedAgent,
  } = useAgentDeploy()
  const [selectedAgent, setSelectedAgent] = useState<Address | null>(null)
  const agentForRegistration = selectedAgent ?? deployedAddress
  const deployPhaseMessage =
    deployPhase === 'awaiting_wallet'
      ? 'Awaiting wallet confirmation...'
      : deployPhase === 'submitted'
      ? 'Transaction submitted. Waiting for confirmation...'
      : deployPhase === 'confirming'
      ? 'Confirming on-chain...'
      : deployPhase === 'timeout'
      ? 'RPC timeout — try again.'
      : deployPhase === 'success'
      ? 'Deployment confirmed.'
      : deployPhase === 'error'
      ? 'Deployment failed. See error details below.'
      : null
  const registerPhaseMessage =
    registerPhase === 'awaiting_wallet'
      ? 'Awaiting wallet confirmation...'
      : registerPhase === 'submitted'
      ? 'Transaction submitted. Waiting for confirmation...'
      : registerPhase === 'confirming'
      ? 'Confirming on-chain...'
      : registerPhase === 'timeout'
      ? 'RPC timeout — try again.'
      : registerPhase === 'success'
      ? 'Registration confirmed.'
      : registerPhase === 'error'
      ? 'Registration failed. See error details below.'
      : null

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Enter a prompt to generate an agent')
      return
    }
    const code = await generateAgent(prompt)
    if (code) {
      toast.success('Agent generated')
    }
  }

  const handleCompile = async () => {
    if (!generatedCode) {
      toast.error('Generate an agent before compiling')
      return
    }
    const result = await compileAgent(generatedCode)
    if (result) {
      toast.success('Compilation succeeded')
    }
  }

  const handleDeploy = async () => {
    if (!walletStatus.ready) {
      toast.error(walletStatus.reason ?? 'Wallet not ready.')
      return
    }
    if (compilationStatus !== 'compiled' || !compiledArtifact) {
      toast.error('Compile your agent before deploying')
      return
    }
    const address = await deployAgent(
      compiledArtifact.bytecode,
      compiledArtifact.abi as Abi,
    )
    if (address) {
      toast.success(`Agent deployed: ${address}`)
    }
  }

  const handleRegister = async () => {
    if (!walletStatus.ready) {
      toast.error(walletStatus.reason ?? 'Wallet not ready.')
      return
    }
    const agentAddress = selectedAgent ?? deployedAddress
    if (!agentAddress) {
      toast.error('Deploy or select an agent before registering')
      return
    }
    if (!battleId.trim()) {
      toast.error('Enter a battle ID to register')
      return
    }

    let parsedBattleId: bigint
    try {
      parsedBattleId = BigInt(battleId.trim())
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Battle ID must be a number'
      toast.error(message)
      return
    }

    const hash = await registerAgentForBattle(
      parsedBattleId,
      agentAddress as Address,
    )
    if (hash) {
      toast.success('Agent registered in battle')
    }
  }

  return (
    <div className={compact ? 'py-0' : 'py-10'}>
      <header className={compact ? 'mb-6' : 'mb-8'}>
        <Heading as="h1" size={compact ? 'h2' : 'h1'}>
          Agent Studio
        </Heading>
        <Text tone="muted">Generate and deploy AI-powered attacker agents</Text>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left Panel - Prompt Input */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <Heading as="h2" size="h3" className="mb-4">
            AI Prompt
          </Heading>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your attack strategy... e.g., 'Create a reentrancy attacker that exploits a vault using checks-effects-interactions violation'"
            className="h-64 w-full resize-none rounded-lg border border-border bg-background p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="mt-4 w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? 'Generating...' : 'Generate Agent'}
          </button>
        </div>

        {/* Right Panel - Code Preview */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Heading as="h2" size="h3">
              Generated Code
            </Heading>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                compilationStatus === 'idle' ? 'bg-gray-500' :
                compilationStatus === 'generated' ? 'bg-yellow-500' :
                compilationStatus === 'compiling' ? 'bg-orange-500' :
                compilationStatus === 'compiled' ? 'bg-green-500' :
                compilationStatus === 'deployed' ? 'bg-blue-500' :
                'bg-red-500'
              }`} />
              <span className="text-xs text-muted-foreground capitalize">
                {compilationStatus}
              </span>
              {compiledArtifact?.contractName && (
                <span className="text-xs text-muted-foreground">
                  {compiledArtifact.contractName}
                </span>
              )}
            </div>
          </div>
          
          <div className="h-64 overflow-auto rounded-lg border border-border bg-background p-4 font-mono text-xs text-muted-foreground">
            {generatedCode ? (
              <pre>{generatedCode}</pre>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Generated code will appear here...
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2 text-sm">
            {missingChainConfig && (
              <div className="rounded-lg border border-yellow-600/60 bg-yellow-900/40 p-3 text-yellow-100">
                Missing <code className="font-mono">NEXT_PUBLIC_CHAIN_ID</code> in{' '}
                <code className="font-mono">frontend/.env</code>.
              </div>
            )}
            {missingRpc && (
              <div className="rounded-lg border border-yellow-600/60 bg-yellow-900/40 p-3 text-yellow-100">
                Missing <code className="font-mono">NEXT_PUBLIC_BATTLECHAIN_RPC_URL</code>{' '}
                in <code className="font-mono">frontend/.env</code>.
              </div>
            )}
            {missingWalletConnectProjectId && (
              <div className="rounded-lg border border-yellow-600/60 bg-yellow-900/40 p-3 text-yellow-100">
                Missing{' '}
                <code className="font-mono">
                  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
                </code>{' '}
                in <code className="font-mono">frontend/.env</code>.
              </div>
            )}
            {wrongNetwork && (
              <div className="rounded-lg border border-red-600/60 bg-red-900/40 p-3 text-red-100">
                Switch to chain {expectedChainId} to deploy or register.
              </div>
            )}
            {/* <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 text-gray-300">
              Set <code className="font-mono">NEXT_PUBLIC_ARENA_ADDRESS</code> and{' '}
              <code className="font-mono">NEXT_PUBLIC_BETTING_ADDRESS</code> in{' '}
              <code className="font-mono">frontend/.env</code> before registering.
            </div> */}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleCompile}
              disabled={!generatedCode || compilationStatus === 'compiling' || compilationStatus === 'compiled'}
              className="flex-1 rounded-lg bg-yellow-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {compilationStatus === 'compiling' ? 'Compiling...' : 'Compile'}
            </button>
            <button
              onClick={handleDeploy}
              disabled={
                compilationStatus !== 'compiled' ||
                deploying ||
                wrongNetwork ||
                missingChainConfig ||
                !walletStatus.ready ||
                missingRpc
              }
              className="flex-1 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deployPhase === 'awaiting_wallet'
                ? 'Awaiting wallet...'
                : deployPhase === 'confirming'
                ? 'Confirming on-chain...'
                : deploying
                ? 'Deploying...'
                : isConnected
                ? 'Deploy to BattleChain'
                : 'Connect Wallet'}
            </button>
          </div>

          {deployPhaseMessage && (
            <Caption className="mt-3">{deployPhaseMessage}</Caption>
          )}

          {agentForRegistration && (
            <div className="mt-4 space-y-3">
              <input
                value={battleId}
                onChange={(e) => setBattleId(e.target.value)}
                placeholder="Battle ID to register"
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                onClick={handleRegister}
                disabled={
                  registering ||
                  wrongNetwork ||
                  missingChainConfig ||
                  !walletStatus.ready ||
                  missingRpc
                }
                className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {registerPhase === 'awaiting_wallet'
                  ? 'Awaiting wallet...'
                  : registerPhase === 'confirming'
                  ? 'Confirming on-chain...'
                  : registering
                  ? 'Registering...'
                  : 'Register Agent in Arena'}
              </button>
              {registerPhaseMessage && <Caption>{registerPhaseMessage}</Caption>}
            </div>
          )}

          {savedAgents.length > 0 ? (
            <div className="mt-4 rounded-lg border border-border bg-background/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <Label>Previously deployed agents</Label>
                {selectedAgent && (
                  <Caption>
                    Selected: {selectedAgent.slice(0, 10)}...
                  </Caption>
                )}
              </div>
              <div className="max-h-[280px] space-y-2 overflow-y-auto pr-2">
                {savedAgents.map((agent) => (
                  <div
                    key={agent}
                    className={`flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between ${
                      selectedAgent === agent
                        ? 'border-blue-500/60 bg-blue-900/20'
                        : 'border-border bg-card'
                    }`}
                  >
                    <span
                      className="min-w-0 max-w-[140px] truncate font-mono text-xs text-muted-foreground"
                      title={agent}
                    >
                      {agent}
                    </span>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => setSelectedAgent(agent)}
                        className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500"
                      >
                        {selectedAgent === agent ? 'Selected' : 'Use'}
                      </button>
                      <button
                        onClick={() => removeSavedAgent(agent)}
                        className="rounded-md border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-border bg-background/60 p-4 text-sm text-muted-foreground">
              No saved agents yet. Deploy an agent to persist it across sessions.
            </div>
          )}

          {deployedAddress && (
            <div className="mt-4 rounded-lg border border-emerald-600/40 bg-emerald-900/20 p-4">
              <Text className="font-semibold text-emerald-200">
                Agent Deployed!
              </Text>
              <Caption className="mt-1 font-mono">Address: {deployedAddress}</Caption>
            </div>
          )}
          {selectedAgent && selectedAgent !== deployedAddress && (
            <div className="mt-4 rounded-lg border border-blue-600/40 bg-blue-900/20 p-4">
              <Text className="font-semibold text-blue-200">Using saved agent</Text>
              <Caption className="mt-1 font-mono">Address: {selectedAgent}</Caption>
            </div>
          )}
          {registrationHash && (
            <div className="mt-4 rounded-lg border border-blue-600/40 bg-blue-900/20 p-4">
              <Text className="font-semibold text-blue-200">Agent Registered!</Text>
              <Caption className="mt-1 font-mono">Tx: {registrationHash}</Caption>
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-lg border border-red-600/40 bg-red-900/20 p-4">
              <Text className="font-semibold text-red-200">Action failed</Text>
              <Caption className="mt-1">{error}</Caption>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      {!compact && (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card">
          <Heading as="h3" size="h3" className="mb-3">
            How it works
          </Heading>
          <div className="mb-4 rounded-lg border border-border bg-background/60 p-4 text-sm text-muted-foreground">
            Create battles from the Arena page, then paste a battle ID here to
            register your agent. After registration, your agent appears on the
            Arena dashboard under the "Saved agents" selector for quick assignment.
          </div>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Enter a detailed prompt describing your attack strategy</li>
            <li>AI generates a Solidity contract implementing your strategy</li>
            <li>Review the generated code and compile to check for errors</li>
            <li>Deploy your agent to the BattleChain testnet</li>
            <li>Register your agent in battles and compete for prizes!</li>
          </ol>
        </div>
      )}
    </div>
  )
}

export default AgentStudio
