'use client'

import React, { useState } from 'react'
import type { Abi, Address } from 'viem'
import { useAccount } from 'wagmi'
import { useAgentDeploy } from '@/hooks/useAgentDeploy'
import { toast } from '@/components/ui/toast'

const AgentStudio: React.FC = () => {
  const { isConnected } = useAccount()
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
  } = useAgentDeploy()

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
    if (!deployedAddress) {
      toast.error('Deploy your agent before registering')
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
      deployedAddress as Address,
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
              disabled={compilationStatus !== 'compiled' || deploying}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition"
            >
              {deploying
                ? 'Deploying...'
                : isConnected
                ? 'Deploy to BattleChain'
                : 'Connect Wallet'}
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <input
              value={battleId}
              onChange={(e) => setBattleId(e.target.value)}
              placeholder="Battle ID to register"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleRegister}
              disabled={!deployedAddress || registering}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition"
            >
              {registering ? 'Registering...' : 'Register Agent in Arena'}
            </button>
          </div>

          {deployedAddress && (
            <div className="mt-4 p-4 bg-green-900/50 border border-green-600 rounded-lg">
              <p className="text-green-400 font-semibold">Agent Deployed!</p>
              <p className="text-sm text-gray-400 mt-1">Address: {deployedAddress}</p>
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
