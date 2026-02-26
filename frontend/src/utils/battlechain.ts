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
export const ARENA_PAGINATION_ABI = [
  {
    type: 'function',
    name: 'getCreatorBattleCount',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCreatorBattles',
    inputs: [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCreatorBattleAt',
    inputs: [{ type: 'address' }, { type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const
const BATTLE_CLAIMABLE_ABI = [
  {
    type: 'function',
    name: 's_agentPrizes',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 's_pendingWithdrawals',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'agentOwner',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const
const BETTING_CLAIMABLE_ABI = [
  {
    type: 'function',
    name: 's_betPayouts',
    inputs: [{ type: 'address' }, { type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const
const AGENT_REGISTERED_EVENT_SIGNATURE =
  'event AgentRegistered(uint256 indexed battleId, address indexed agent)'
export const AGENT_REGISTERED_EVENT = parseAbiItem(
  AGENT_REGISTERED_EVENT_SIGNATURE,
)
export const PRIZE_CLAIMED_EVENT = parseAbiItem(
  'event PrizeClaimed(address indexed winner, uint256 amount)',
)
export const BET_CLAIMED_EVENT = parseAbiItem(
  'event BetClaimed(uint256 indexed battleId, address indexed bettor, uint256 payout)',
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
  console.info('[AgentDiscovery] request', {
    owner,
    arenaAddress: ARENA_ADDRESS,
    chainId: client.chain?.id,
    rpcUrl: RPC_URL,
  })

  if (!ARENA_ADDRESS) {
    console.error('Agent discovery skipped: missing arena address', {
      arenaAddress: ARENA_ADDRESS,
      chainId: client.chain?.id,
      owner,
    })
    return []
  }

  let logs: Array<{ args?: { agent?: Address } }>

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
    console.error('Agent discovery RPC failed', {
      error,
      arenaAddress: ARENA_ADDRESS,
      chainId: client.chain?.id,
      owner,
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
        console.error('Agent discovery owner check failed', {
          error,
          agent,
          arenaAddress: ARENA_ADDRESS,
          chainId: client.chain?.id,
          owner,
        })
        continue
      }

      console.info('[AgentDiscovery] owner', { agent, foundOwner })

      if (normalizeAgentAddress(foundOwner) === normalizedOwner) {
        console.info('[AgentDiscovery] match', { agent, owner })
        matches.push(normalizedAgent)
      }
    } catch (error) {
      console.error('Agent discovery parse failed', {
        error,
        arenaAddress: ARENA_ADDRESS,
        chainId: client.chain?.id,
        owner,
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

export const claimPrize = async (client: WalletClient, battleId: bigint) =>
  client.writeContract({
    address: ARENA_ADDRESS,
    abi: ARENA_ABI,
    functionName: 'claimPrize',
    args: [battleId],
  })

export const claimPayout = async (client: WalletClient, battleId: bigint) =>
  client.writeContract({
    address: BETTING_ADDRESS,
    abi: BETTING_ABI,
    functionName: 'claimPayout',
    args: [battleId],
  })

export const withdrawPending = async (
  client: WalletClient,
  battleAddress: Address,
) =>
  client.writeContract({
    address: battleAddress,
    abi: BATTLE_CLAIMABLE_ABI,
    functionName: 'withdraw',
  })

export const getClaimablePrize = async (
  client: PublicClient,
  battleAddress: Address,
  account: Address,
) =>
  client.readContract({
    address: battleAddress,
    abi: BATTLE_CLAIMABLE_ABI,
    functionName: 's_agentPrizes',
    args: [account],
  })

export const getPendingWithdrawal = async (
  client: PublicClient,
  battleAddress: Address,
  account: Address,
) =>
  client.readContract({
    address: battleAddress,
    abi: BATTLE_CLAIMABLE_ABI,
    functionName: 's_pendingWithdrawals',
    args: [account],
  })

export const getAgentOwner = async (
  client: PublicClient,
  battleAddress: Address,
  agent: Address,
) =>
  client.readContract({
    address: battleAddress,
    abi: BATTLE_CLAIMABLE_ABI,
    functionName: 'agentOwner',
    args: [agent],
  })

export const getClaimableBetPayout = async (
  client: PublicClient,
  battleId: bigint,
  account: Address,
) =>
  client.readContract({
    address: BETTING_ADDRESS,
    abi: BETTING_CLAIMABLE_ABI,
    functionName: 's_betPayouts',
    args: [account, battleId],
  })

export const getBetForWinner = async (
  client: PublicClient,
  battleId: bigint,
  bettor: Address,
) => {
  const battle = (await client.readContract({
    address: BETTING_ADDRESS,
    abi: BETTING_ABI,
    functionName: 'battles',
    args: [battleId],
  })) as { resolved: boolean; winningAgentIndex: bigint }

  if (!battle.resolved) {
    return { amount: 0n, claimed: false, resolved: false }
  }

  const bet = (await client.readContract({
    address: BETTING_ADDRESS,
    abi: BETTING_ABI,
    functionName: 'bets',
    args: [battleId, battle.winningAgentIndex, bettor],
  })) as { amount: bigint; claimed: boolean }

  return { ...bet, resolved: true }
}
