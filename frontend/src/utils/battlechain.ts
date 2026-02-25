import type { Abi, Address, PublicClient, WalletClient } from 'viem'
import { parseAbiItem, parseEther } from 'viem'
import ArenaAbi from '@/abis/Arena.json'
import BattleAbi from '@/abis/Battle.json'
import SpectatorBettingAbi from '@/abis/SpectatorBetting.json'
import type { ChallengeType } from '@/types/contracts'

export const ARENA_ADDRESS = process.env.NEXT_PUBLIC_ARENA_ADDRESS as Address
export const BETTING_ADDRESS = process.env.NEXT_PUBLIC_BETTING_ADDRESS as Address
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
export const AGENT_REGISTERED_EVENT = parseAbiItem(
  'event AgentRegistered(uint256 indexed battleId, address indexed agent)',
)

const normalizeAgentAddress = (address: Address) =>
  address.toLowerCase() as Address

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
): Promise<Address[]> => {
  if (!ARENA_ADDRESS) {
    console.error('Agent discovery skipped: missing arena address', {
      arenaAddress: ARENA_ADDRESS,
      chainId: client.chain?.id,
    })
    return []
  }

  let logs: Array<{ args?: { agent?: Address } }>

  try {
    logs = await client.getLogs({
      address: ARENA_ADDRESS,
      event: AGENT_REGISTERED_EVENT,
      fromBlock: 0n,
      toBlock: 'latest',
    })
  } catch (error) {
    console.error('Agent discovery RPC failed', {
      error,
      arenaAddress: ARENA_ADDRESS,
      chainId: client.chain?.id,
    })
    return []
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
        })
        continue
      }

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
        console.error('Agent discovery owner check failed', {
          error,
          agent,
          arenaAddress: ARENA_ADDRESS,
          chainId: client.chain?.id,
        })
        continue
      }

      if (normalizeAgentAddress(foundOwner) === normalizedOwner) {
        matches.push(normalizedAgent)
      }
    } catch (error) {
      console.error('Agent discovery parse failed', {
        error,
        arenaAddress: ARENA_ADDRESS,
        chainId: client.chain?.id,
      })
    }
  }

  return matches
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
  client: WalletClient,
  challengeType: ChallengeType,
  entryFeeEth: number,
  maxAgents: number,
  duration: number,
) => {
  const entryFeeWei = parseEther(entryFeeEth.toString())
  return client.writeContract({
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
