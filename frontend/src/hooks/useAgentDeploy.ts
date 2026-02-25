import { useEffect, useState } from 'react'
import type { Abi, Address } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import {
  addSavedAgent,
  loadSavedAgents,
  registerAgent as registerAgentOnArena,
  removeSavedAgent,
} from '@/utils/battlechain'

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
  const expectedChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID)
  const hasExpectedChainId = Number.isFinite(expectedChainId) && expectedChainId > 0
  const publicClient = usePublicClient({
    chainId: hasExpectedChainId ? expectedChainId : undefined,
  })
  const { data: walletClient } = useWalletClient({
    chainId: hasExpectedChainId ? expectedChainId : undefined,
  })
  const rpcUrl = process.env.NEXT_PUBLIC_BATTLECHAIN_RPC_URL
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
  const [savedAgents, setSavedAgents] = useState<Address[]>([])

  useEffect(() => {
    setSavedAgents(loadSavedAgents())
  }, [])

  const validateWalletClients = () => {
    if (!hasExpectedChainId) {
      throw new Error('Missing NEXT_PUBLIC_CHAIN_ID in frontend env config.')
    }
    if (!rpcUrl) {
      throw new Error(
        'RPC unavailable. Check NEXT_PUBLIC_BATTLECHAIN_RPC_URL in frontend env config.',
      )
    }
    if (!publicClient) {
      throw new Error(
        'RPC unavailable. Check NEXT_PUBLIC_BATTLECHAIN_RPC_URL in frontend env config.',
      )
    }
    if (!walletClient) {
      throw new Error('Wallet client unavailable. Reconnect wallet and try again.')
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

      if (!walletClient) {
        throw new Error('Wallet client not found')
      }

      if (!publicClient) {
        throw new Error('Public client not found')
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
      setSavedAgents(addSavedAgent(receipt.contractAddress))

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

      if (!walletClient) {
        throw new Error('Wallet client not found')
      }

      if (!publicClient) {
        throw new Error('Public client not found')
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
    savedAgents,
    removeSavedAgent: (address: Address) => {
      setSavedAgents(removeSavedAgent(address))
    },
    generateAgent,
    compileAgent,
    deployAgent,
    registerAgentForBattle,
  }
}
