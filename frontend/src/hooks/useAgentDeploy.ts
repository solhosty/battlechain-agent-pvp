import { useEffect, useState } from 'react'
import type { Abi, Address } from 'viem'
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi'
import {
  addSavedAgent,
  getGasOverrides,
  loadSavedAgents,
  registerAgent as registerAgentOnArena,
  removeSavedAgent,
} from '@/utils/battlechain'
import { formatWalletError } from '@/utils/walletErrors'

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

type ActionPhase =
  | 'idle'
  | 'awaiting_wallet'
  | 'submitted'
  | 'confirming'
  | 'timeout'
  | 'error'
  | 'success'

interface WalletStatus {
  ready: boolean
  reason: string | null
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
  const { isConnected } = useAccount()
  const chainId = useChainId()
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
  const [deployPhase, setDeployPhase] = useState<ActionPhase>('idle')
  const [registerPhase, setRegisterPhase] = useState<ActionPhase>('idle')
  const [registrationHash, setRegistrationHash] = useState<
    `0x${string}` | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [savedAgents, setSavedAgents] = useState<Address[]>([])

  const walletStatus: WalletStatus = (() => {
    if (!hasExpectedChainId) {
      return {
        ready: false,
        reason: 'Missing NEXT_PUBLIC_CHAIN_ID in frontend env config.',
      }
    }
    if (!rpcUrl) {
      return {
        ready: false,
        reason:
          'RPC unavailable. Check NEXT_PUBLIC_BATTLECHAIN_RPC_URL in frontend env config.',
      }
    }
    if (!publicClient) {
      return {
        ready: false,
        reason:
          'RPC unavailable. Check NEXT_PUBLIC_BATTLECHAIN_RPC_URL in frontend env config.',
      }
    }
    if (!isConnected) {
      return {
        ready: false,
        reason: 'Connect your wallet from the navigation bar.',
      }
    }
    if (!walletClient) {
      return {
        ready: false,
        reason: 'Wallet client unavailable. Reconnect wallet and try again.',
      }
    }
    const actualChainId =
      chainId ?? walletClient.chain?.id ?? publicClient.chain?.id
    if (actualChainId && actualChainId !== expectedChainId) {
      return {
        ready: false,
        reason: `Wrong network. Switch to chain ${expectedChainId}.`,
      }
    }

    return {
      ready: true,
      reason: null,
    }
  })()

  useEffect(() => {
    setSavedAgents(loadSavedAgents())
  }, [])

  const validateWalletClients = () => {
    if (!walletStatus.ready) {
      throw new Error(walletStatus.reason ?? 'Wallet not ready.')
    }
  }

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
      const message = formatWalletError(error)
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
      const message = formatWalletError(error)
      console.error('Compilation failed:', message)
      setError(message)
      setCompilationStatus('error')
      return null
    }
  }

  const deployAgent = async (bytecode: `0x${string}`, abi: Abi) => {
    setDeploying(true)
    setDeployPhase('awaiting_wallet')
    try {
      setError(null)
      validateWalletClients()

      if (!walletClient) {
        throw new Error('Wallet client unavailable. Reconnect wallet and try again.')
      }

      if (!publicClient) {
        throw new Error(
          'RPC unavailable. Check NEXT_PUBLIC_BATTLECHAIN_RPC_URL in frontend env config.',
        )
      }

      const gasOverrides = await getGasOverrides(publicClient)
      const hash = await walletClient.deployContract({
        abi,
        bytecode,
        ...gasOverrides,
      })
      setDeployPhase('submitted')
      setDeployPhase('confirming')
      const receipt = await waitForReceiptWithTimeout(hash)

      if (!receipt.contractAddress) {
        throw new Error('Contract address not found')
      }

      setDeployedAddress(receipt.contractAddress)
      setCompilationStatus('deployed')
      setSavedAgents(addSavedAgent(receipt.contractAddress))
      setDeployPhase('success')

      return receipt.contractAddress
    } catch (error) {
      const message = formatWalletError(error)
      console.error('Deployment failed:', message)
      setError(message)
      setCompilationStatus('error')
      setDeployPhase(
        message.toLowerCase().includes('timeout') ? 'timeout' : 'error',
      )
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
    setRegisterPhase('awaiting_wallet')
    try {
      setError(null)
      validateWalletClients()

      if (!walletClient) {
        throw new Error('Wallet client unavailable. Reconnect wallet and try again.')
      }

      if (!publicClient) {
        throw new Error(
          'RPC unavailable. Check NEXT_PUBLIC_BATTLECHAIN_RPC_URL in frontend env config.',
        )
      }

      const gasOverrides = await getGasOverrides(publicClient)
      const hash = await registerAgentOnArena(
        walletClient,
        battleId,
        agentAddress,
        gasOverrides,
      )
      setRegisterPhase('submitted')
      setRegisterPhase('confirming')
      await waitForReceiptWithTimeout(hash)
      setRegistrationHash(hash)
      setRegisterPhase('success')

      return hash
    } catch (error) {
      const message = formatWalletError(error)
      console.error('Registration failed:', message)
      setError(message)
      setRegisterPhase(
        message.toLowerCase().includes('timeout') ? 'timeout' : 'error',
      )
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
    walletStatus,
    deployPhase,
    registerPhase,
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
