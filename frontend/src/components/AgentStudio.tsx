'use client'

import React, { useState } from 'react'
import type { Abi, Address } from 'viem'
import { useAccount, useChainId, useWalletClient } from 'wagmi'
import { useAgentDeploy } from '@/hooks/useAgentDeploy'
import { toast } from '@/components/ui/toast'

const AgentStudio: React.FC = () => {
  const { isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId()
  const expectedChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID)
  const hasExpectedChainId = Number.isFinite(expectedChainId) && expectedChainId > 0
  const walletClientReady = Boolean(walletClient)
  const rpcUrl = process.env.NEXT_PUBLIC_BATTLECHAIN_RPC_URL
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
    generateAgent,
    compileAgent,
    deployAgent,
    registerAgentForBattle,
    savedAgents,
    removeSavedAgent,
  } = useAgentDeploy()
  const [selectedAgent, setSelectedAgent] = useState<Address | null>(null)
  const agentForRegistration = selectedAgent ?? deployedAddress

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
    if (!isConnected) {
      toast.error('Connect your wallet from the navigation bar')
      return
    }
    if (!walletClientReady) {
      toast.error('Wallet client not ready. Reconnect wallet and try again.')
      return
    }
    if (missingChainConfig) {
      toast.error('Missing NEXT_PUBLIC_CHAIN_ID in frontend env config')
      return
    }
    if (missingRpc) {
      toast.error('Missing NEXT_PUBLIC_BATTLECHAIN_RPC_URL in frontend env config')
      return
    }
    if (wrongNetwork) {
      toast.error(`Wrong network. Switch to chain ${expectedChainId}.`)
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
    if (!isConnected) {
      toast.error('Connect your wallet from the navigation bar')
      return
    }
    if (!walletClientReady) {
      toast.error('Wallet client not ready. Reconnect wallet and try again.')
      return
    }
    if (missingChainConfig) {
      toast.error('Missing NEXT_PUBLIC_CHAIN_ID in frontend env config')
      return
    }
    if (missingRpc) {
      toast.error('Missing NEXT_PUBLIC_BATTLECHAIN_RPC_URL in frontend env config')
      return
    }
    if (wrongNetwork) {
      toast.error(`Wrong network. Switch to chain ${expectedChainId}.`)
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
    <div className="py-10">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Agent Studio</h1>
        <p className="text-gray-400">Generate and deploy AI-powered attacker agents</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Panel - Prompt Input */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4">AI Prompt</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your attack strategy... e.g., 'Create a reentrancy attacker that exploits a vault using checks-effects-interactions violation'"
            className="w-full h-64 bg-gray-700 border border-gray-600 rounded-lg p-4 text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition"
          >
            {generating ? 'Generating...' : 'Generate Agent'}
          </button>
        </div>

        {/* Right Panel - Code Preview */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Generated Code</h2>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                compilationStatus === 'idle' ? 'bg-gray-500' :
                compilationStatus === 'generated' ? 'bg-yellow-500' :
                compilationStatus === 'compiling' ? 'bg-orange-500' :
                compilationStatus === 'compiled' ? 'bg-green-500' :
                compilationStatus === 'deployed' ? 'bg-blue-500' :
                'bg-red-500'
              }`} />
              <span className="text-sm text-gray-400 capitalize">{compilationStatus}</span>
              {compiledArtifact?.contractName && (
                <span className="text-xs text-gray-500">{compiledArtifact.contractName}</span>
              )}
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-300 h-64 overflow-auto">
            {generatedCode ? (
              <pre>{generatedCode}</pre>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-600">
                Generated code will appear here...
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2 text-sm">
            {missingChainConfig && (
              <div className="rounded-lg border border-yellow-600 bg-yellow-900/40 p-3 text-yellow-200">
                Missing <code className="font-mono">NEXT_PUBLIC_CHAIN_ID</code> in{' '}
                <code className="font-mono">frontend/.env</code>.
              </div>
            )}
            {missingRpc && (
              <div className="rounded-lg border border-yellow-600 bg-yellow-900/40 p-3 text-yellow-200">
                Missing <code className="font-mono">NEXT_PUBLIC_BATTLECHAIN_RPC_URL</code>{' '}
                in <code className="font-mono">frontend/.env</code>.
              </div>
            )}
            {wrongNetwork && (
              <div className="rounded-lg border border-red-600 bg-red-900/40 p-3 text-red-200">
                Switch to chain {expectedChainId} to deploy or register.
              </div>
            )}
            {/* <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 text-gray-300">
              Set <code className="font-mono">NEXT_PUBLIC_ARENA_ADDRESS</code> and{' '}
              <code className="font-mono">NEXT_PUBLIC_BETTING_ADDRESS</code> in{' '}
              <code className="font-mono">frontend/.env</code> before registering.
            </div> */}
          </div>

          <div className="mt-4 flex gap-4">
            <button
              onClick={handleCompile}
              disabled={!generatedCode || compilationStatus === 'compiling' || compilationStatus === 'compiled'}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition"
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
                !walletClientReady ||
                missingRpc
              }
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition"
            >
              {deploying
                ? 'Deploying...'
                : isConnected
                ? 'Deploy to BattleChain'
                : 'Connect Wallet'}
            </button>
          </div>

          {agentForRegistration && (
            <div className="mt-4 space-y-3">
              <input
                value={battleId}
                onChange={(e) => setBattleId(e.target.value)}
                placeholder="Battle ID to register"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleRegister}
                disabled={
                  registering ||
                  wrongNetwork ||
                  missingChainConfig ||
                  !walletClientReady ||
                  missingRpc
                }
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition"
              >
                {registering ? 'Registering...' : 'Register Agent in Arena'}
              </button>
            </div>
          )}

          {savedAgents.length > 0 ? (
            <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-200">
                  Previously Deployed Agents
                </h3>
                {selectedAgent && (
                  <span className="text-xs text-gray-400">
                    Selected: {selectedAgent.slice(0, 10)}...
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {savedAgents.map((agent) => (
                  <div
                    key={agent}
                    className={`flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between ${
                      selectedAgent === agent
                        ? 'border-blue-500 bg-blue-900/30'
                        : 'border-gray-700 bg-gray-800/60'
                    }`}
                  >
                    <span className="font-mono text-xs text-gray-300">
                      {agent}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedAgent(agent)}
                        className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        {selectedAgent === agent
                          ? 'Selected'
                          : 'Use for Registration'}
                      </button>
                      <button
                        onClick={() => removeSavedAgent(agent)}
                        className="rounded-md border border-gray-600 px-3 py-1 text-xs text-gray-200 hover:border-gray-500"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900/50 p-4 text-sm text-gray-400">
              No saved agents yet. Deploy an agent to persist it across sessions.
            </div>
          )}

          {deployedAddress && (
            <div className="mt-4 p-4 bg-green-900/50 border border-green-600 rounded-lg">
              <p className="text-green-400 font-semibold">Agent Deployed!</p>
              <p className="text-sm text-gray-400 mt-1">Address: {deployedAddress}</p>
            </div>
          )}
          {selectedAgent && selectedAgent !== deployedAddress && (
            <div className="mt-4 p-4 bg-blue-900/40 border border-blue-700 rounded-lg">
              <p className="text-blue-300 font-semibold">Using saved agent</p>
              <p className="text-sm text-gray-300 mt-1">Address: {selectedAgent}</p>
            </div>
          )}
          {registrationHash && (
            <div className="mt-4 p-4 bg-blue-900/50 border border-blue-600 rounded-lg">
              <p className="text-blue-400 font-semibold">Agent Registered!</p>
              <p className="text-sm text-gray-400 mt-1">Tx: {registrationHash}</p>
            </div>
          )}
          {error && (
            <div className="mt-4 p-4 bg-red-900/50 border border-red-600 rounded-lg">
              <p className="text-red-400 font-semibold">Action failed</p>
              <p className="text-sm text-gray-400 mt-1">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">How it works</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-400">
          <li>Enter a detailed prompt describing your attack strategy</li>
          <li>AI generates a Solidity contract implementing your strategy</li>
          <li>Review the generated code and compile to check for errors</li>
          <li>Deploy your agent to the BattleChain testnet</li>
          <li>Register your agent in battles and compete for prizes!</li>
        </ol>
      </div>
    </div>
  )
}

export default AgentStudio
