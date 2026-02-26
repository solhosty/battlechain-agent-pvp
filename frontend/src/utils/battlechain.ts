import type { Abi, Address, PublicClient, WalletClient } from 'viem'
import { parseAbiItem, parseEther } from 'viem'
import ArenaAbi from '@/abis/Arena.json'
import BattleAbi from '@/abis/Battle.json'
import SpectatorBettingAbi from '@/abis/SpectatorBetting.json'
import type { ChallengeType } from '@/types/contracts'

export const ARENA_ADDRESS = process.env.NEXT_PUBLIC_ARENA_ADDRESS as Address
export const BETTING_ADDRESS = process.env.NEXT_PUBLIC_BETTING_ADDRESS as Address
export const RPC_URL = process.env.NEXT_PUBLIC_BATTLECHAIN_RPC_URL
export const ARENA_ABI = ArenaAbi.abi as Abi
export const BATTLE_ABI = BattleAbi.abi as Abi
export const BETTING_ABI = SpectatorBettingAbi.abi as Abi
export const AGENT_STORAGE_KEY = 'battlechain.deployedAgents'
export const AGENT_ABI = [
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const
const AGENT_REGISTERED_EVENT_SIGNATURE =
  'event AgentRegistered(uint256 indexed battleId, address indexed agent)'
export const AGENT_REGISTERED_EVENT = parseAbiItem(
  AGENT_REGISTERED_EVENT_SIGNATURE,
)

const normalizeAgentAddress = (address: Address) =>
  address.toLowerCase() as Address

const formatViemError = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const assertContractDeployed = async (
  client: PublicClient,
  address: Address | undefined,
  label: string,
) => {
  if (!address) {
    throw new Error(
      `Missing ${label} contract address (NEXT_PUBLIC_ARENA_ADDRESS)`,
    )
  }

  try {
    const bytecode = await client.getBytecode({ address })
    if (!bytecode || bytecode === '0x') {
      throw new Error(`${label} contract not found at address ${address}`)
    }
  } catch (error) {
    const formatted = formatViemError(error)
    console.error('[ContractCheck] failed', {
      label,
      address,
      chainId: client.chain?.id,
      rpcUrl: RPC_URL,
      error: formatted,
    })
    if (
      formatted.includes('contract not found') ||
      formatted.includes('Missing')
    ) {
      throw new Error(formatted)
    }
    throw new Error(`Failed to verify ${label} at address ${address}`)
  }
}

const parseStoredAgents = (value: string | null): Address[] => {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((agent): agent is Address => typeof agent === 'string')
  } catch (error) {
    return []
  }
}

export const loadSavedAgents = (): Address[] => {
  if (typeof window === 'undefined') {
    return []
  }

  const parsed = parseStoredAgents(localStorage.getItem(AGENT_STORAGE_KEY))
  return parsed.map((agent) => normalizeAgentAddress(agent))
}

export const persistSavedAgents = (agents: Address[]) => {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(agents))
}

export const mergeSavedAgents = (
  existing: Address[],
  discovered: Address[],
): Address[] => {
  const merged = new Map<Address, Address>()

  for (const agent of existing) {
    const normalized = normalizeAgentAddress(agent)
    merged.set(normalized, normalized)
  }

  for (const agent of discovered) {
    const normalized = normalizeAgentAddress(agent)
    merged.set(normalized, normalized)
  }

  return Array.from(merged.values())
}

export const addSavedAgent = (address: Address): Address[] => {
  const normalized = normalizeAgentAddress(address)
  if (typeof window === 'undefined') {
    return [normalized]
  }

  const current = loadSavedAgents()
  if (current.some((agent) => normalizeAgentAddress(agent) === normalized)) {
    return current
  }

  const next = [...current, normalized]
  persistSavedAgents(next)
  return next
}

export const removeSavedAgent = (address: Address): Address[] => {
  const normalized = normalizeAgentAddress(address)
  if (typeof window === 'undefined') {
    return []
  }

  const current = loadSavedAgents()
  const next = current.filter(
    (agent) => normalizeAgentAddress(agent) !== normalized,
  )
  persistSavedAgents(next)
  return next
}

export const discoverAgentsByOwner = async (
  client: PublicClient,
  owner: Address,
): Promise<{ agents: Address[]; errors: string[] }> => {
  console.info('[AgentDiscovery] request', {
    owner,
    arenaAddress: ARENA_ADDRESS,
    chainId: client.chain?.id,
    rpcUrl: RPC_URL,
  })

  await assertContractDeployed(client, ARENA_ADDRESS, 'Arena')

  let logs: Array<{ args?: { agent?: Address } }>
  const errors: string[] = []

  const fromBlock = 0n
  const toBlock = 'latest'

  try {
    logs = await client.getLogs({
      address: ARENA_ADDRESS,
      event: AGENT_REGISTERED_EVENT,
      fromBlock,
      toBlock,
    })
    console.info('[AgentDiscovery] getLogs', {
      count: logs.length,
      fromBlock,
      toBlock,
      arenaAddress: ARENA_ADDRESS,
      chainId: client.chain?.id,
      owner,
    })
  } catch (error) {
    const formatted = formatViemError(error)
    console.error('Agent discovery RPC failed', {
      error: formatted,
      arenaAddress: ARENA_ADDRESS,
      chainId: client.chain?.id,
      owner,
      rpcUrl: RPC_URL,
    })
    errors.push(`Failed to fetch Arena agent logs: ${formatted}`)
    return { agents: [], errors }
  }

  const matches: Address[] = []
  const normalizedOwner = normalizeAgentAddress(owner)

  for (const log of logs) {
    try {
      const agent = log.args?.agent
      if (!agent) {
        console.error('Agent discovery log missing agent', {
          log,
          arenaAddress: ARENA_ADDRESS,
          chainId: client.chain?.id,
          owner,
        })
        continue
      }

      console.info('[AgentDiscovery] log', { agent })

      const normalizedAgent = normalizeAgentAddress(agent)
      if (matches.includes(normalizedAgent)) {
        continue
      }

      let foundOwner: Address
      try {
        foundOwner = (await client.readContract({
          address: agent,
          abi: AGENT_ABI,
          functionName: 'owner',
        })) as Address
      } catch (error) {
        const formatted = formatViemError(error)
        console.error('Agent discovery owner check failed', {
          error: formatted,
          agent,
          arenaAddress: ARENA_ADDRESS,
          chainId: client.chain?.id,
          owner,
          rpcUrl: RPC_URL,
        })
        errors.push(`Agent contract does not respond to owner() call: ${agent}`)
        continue
      }

      console.info('[AgentDiscovery] owner', { agent, foundOwner })

      if (normalizeAgentAddress(foundOwner) === normalizedOwner) {
        console.info('[AgentDiscovery] match', { agent, owner })
        matches.push(normalizedAgent)
      }
    } catch (error) {
      const formatted = formatViemError(error)
      console.error('Agent discovery parse failed', {
        error: formatted,
        arenaAddress: ARENA_ADDRESS,
        chainId: client.chain?.id,
        owner,
        rpcUrl: RPC_URL,
      })
    }
  }

  return { agents: matches, errors }
}

export const getBattleAddress = async (
  client: PublicClient,
  battleId: bigint,
) =>
  client.readContract({
    address: ARENA_ADDRESS,
    abi: ARENA_ABI,
    functionName: 'battles',
    args: [battleId],
  })

export const getBattleAgents = async (
  client: PublicClient,
  battleAddress: Address,
) =>
  client.readContract({
    address: battleAddress,
    abi: BATTLE_ABI,
    functionName: 'getAgents',
  })

export const createBattle = async (
  walletClient: WalletClient,
  publicClient: PublicClient,
  challengeType: ChallengeType,
  entryFeeEth: number,
  maxAgents: number,
  duration: number,
) => {
  await assertContractDeployed(publicClient, ARENA_ADDRESS, 'Arena')
  const entryFeeWei = parseEther(entryFeeEth.toString())
  return walletClient.writeContract({
    address: ARENA_ADDRESS,
    abi: ARENA_ABI,
    functionName: 'createBattle',
    args: [challengeType, entryFeeWei, maxAgents, duration],
    value: entryFeeWei,
  })
}

export const registerAgent = async (
  client: WalletClient,
  battleId: bigint,
  agentAddress: Address,
) =>
  client.writeContract({
    address: ARENA_ADDRESS,
    abi: ARENA_ABI,
    functionName: 'registerAgent',
    args: [battleId, agentAddress],
  })

export const startBattle = async (client: WalletClient, battleId: bigint) =>
  client.writeContract({
    address: ARENA_ADDRESS,
    abi: ARENA_ABI,
    functionName: 'startBattle',
    args: [battleId],
  })

export const resolveBattle = async (client: WalletClient, battleId: bigint) =>
  client.writeContract({
    address: ARENA_ADDRESS,
    abi: ARENA_ABI,
    functionName: 'resolveBattle',
    args: [battleId],
  })

export const placeBet = async (
  client: WalletClient,
  battleId: bigint,
  agentIndex: bigint,
  amountEth: number,
) =>
  client.writeContract({
    address: BETTING_ADDRESS,
    abi: BETTING_ABI,
    functionName: 'placeBet',
    args: [battleId, agentIndex],
    value: parseEther(amountEth.toString()),
  })
