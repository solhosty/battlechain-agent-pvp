import { useState } from 'react'
import type { Abi, Address } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import { registerAgent as registerAgentOnArena } from '../utils/battlechain'

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
}

const API_BASE_URL = import.meta.env.VITE_AGENT_STUDIO_API_URL as
  | string
  | undefined

const request = async <TResponse>(path: string, payload: unknown) => {
  if (!API_BASE_URL) {
    throw new Error('Missing VITE_AGENT_STUDIO_API_URL')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed (${response.status})`)
  }

  return (await response.json()) as TResponse
}

export const useAgentDeploy = () => {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
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
      setCompiledArtifact({ abi: response.abi, bytecode: response.bytecode })
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
      if (!walletClient || !publicClient) {
        throw new Error('Wallet not connected')
      }

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
      if (!walletClient || !publicClient) {
        throw new Error('Wallet not connected')
      }

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
