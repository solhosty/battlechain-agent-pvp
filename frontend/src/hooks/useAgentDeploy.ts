import { useState } from 'react'
import type { Abi, Address } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import { registerAgent as registerAgentOnArena } from '@/utils/battlechain'

type CompilationStatus =
  | 'idle'
  | 'generated'
  | 'compiling'
  | 'compiled'
  | 'deployed'
  | 'error'

interface CompilationResult {
  abi: Abi
  bytecode: `0x${string}`
  contractName?: string
}

const request = async <TResponse>(path: string, payload: unknown) => {
  const response = await fetch(`/api${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => null)
      const message = payload?.error || `Request failed (${response.status})`
      throw new Error(message)
    }
    const message = await response.text()
    throw new Error(message || `Request failed (${response.status})`)
  }

  return (await response.json()) as TResponse
}

export const useAgentDeploy = () => {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const expectedChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID)
  const hasExpectedChainId = Number.isFinite(expectedChainId) && expectedChainId > 0
  const [generating, setGenerating] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')
  const [compilationStatus, setCompilationStatus] =
    useState<CompilationStatus>('idle')
  const [compiledArtifact, setCompiledArtifact] =
    useState<CompilationResult | null>(null)
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null)
  const [registering, setRegistering] = useState(false)
  const [registrationHash, setRegistrationHash] = useState<
    `0x${string}` | null
  >(null)
  const [error, setError] = useState<string | null>(null)

  const validateWalletClients = () => {
    if (!walletClient || !publicClient) {
      throw new Error(
        'Wallet not connected or RPC unavailable. Connect wallet and check chain config.',
      )
    }
    if (!hasExpectedChainId) {
      throw new Error('Missing NEXT_PUBLIC_CHAIN_ID in frontend env config.')
    }
    const actualChainId = walletClient.chain?.id ?? publicClient.chain?.id
    if (actualChainId && actualChainId !== expectedChainId) {
      throw new Error(`Wrong network. Switch to chain ${expectedChainId}.`)
    }
  }

  const generateAgent = async (prompt: string) => {
    setGenerating(true)
    try {
      setError(null)
      const response = await request<{ code?: string; source?: string }>(
        '/agents/generate',
        {
          prompt,
        },
      )
      const code = response.code ?? response.source
      if (!code) {
        throw new Error('Generation API returned no code')
      }
      setGeneratedCode(code)
      setCompilationStatus('generated')
      setCompiledArtifact(null)

      return code
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Failed to generate agent:', message)
      setError(message)
      setCompilationStatus('error')
    } finally {
      setGenerating(false)
    }
  }

  const compileAgent = async (code: string) => {
    setCompilationStatus('compiling')
    try {
      setError(null)
      const response = await request<CompilationResult>(
        '/agents/compile',
        {
          code,
        },
      )
      if (!response.abi || !response.bytecode) {
        throw new Error('Compilation API returned incomplete artifacts')
      }
      setCompiledArtifact({
        abi: response.abi,
        bytecode: response.bytecode,
        contractName: response.contractName,
      })
      setCompilationStatus('compiled')
      return response
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Compilation failed:', message)
      setError(message)
      setCompilationStatus('error')
      return null
    }
  }

  const deployAgent = async (bytecode: `0x${string}`, abi: Abi) => {
    setDeploying(true)
    try {
      setError(null)
      validateWalletClients()

      const hash = await walletClient.deployContract({
        abi,
        bytecode,
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      if (!receipt.contractAddress) {
        throw new Error('Contract address not found')
      }

      setDeployedAddress(receipt.contractAddress)
      setCompilationStatus('deployed')

      return receipt.contractAddress
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Deployment failed:', message)
      setError(message)
      setCompilationStatus('error')
      return null
    } finally {
      setDeploying(false)
    }
  }

  const registerAgentForBattle = async (
    battleId: bigint,
    agentAddress: Address,
  ) => {
    setRegistering(true)
    try {
      setError(null)
      validateWalletClients()

      const hash = await registerAgentOnArena(
        walletClient,
        battleId,
        agentAddress,
      )
      await publicClient.waitForTransactionReceipt({ hash })
      setRegistrationHash(hash)

      return hash
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Registration failed:', message)
      setError(message)
      return null
    } finally {
      setRegistering(false)
    }
  }

  return {
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
  }
}
