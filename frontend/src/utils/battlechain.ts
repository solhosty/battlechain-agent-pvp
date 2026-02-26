import type { Abi, Address, PublicClient, WalletClient } from 'viem'
import { parseAbiItem, parseEther, parseGwei } from 'viem'
import ArenaAbi from '@/abis/Arena.json'
import BattleAbi from '@/abis/Battle.json'
import AgentFactoryAbi from '@/abis/AgentFactory.json'
import SpectatorBettingAbi from '@/abis/SpectatorBetting.json'
import type { ChallengeType } from '@/types/contracts'

export const ARENA_ADDRESS = process.env.NEXT_PUBLIC_ARENA_ADDRESS as Address
export const BETTING_ADDRESS = process.env.NEXT_PUBLIC_BETTING_ADDRESS as Address
export const AGENT_FACTORY_ADDRESS =
  process.env.NEXT_PUBLIC_AGENT_FACTORY_ADDRESS as Address
export const ARENA_ABI = ArenaAbi.abi as Abi
export const BATTLE_ABI = BattleAbi.abi as Abi
export const AGENT_FACTORY_ABI = AgentFactoryAbi.abi as Abi
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
const AGENT_CREATED_EVENT_SIGNATURE =
  'event AgentCreated(address indexed agent, address indexed owner)'
export const AGENT_CREATED_EVENT = parseAbiItem(AGENT_CREATED_EVENT_SIGNATURE)

export type GasOverrides = {
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  gasPrice?: bigint
  nonce?: number
}

const parseGweiEnv = (value: string | undefined): bigint | undefined => {
  if (!value) {
    return undefined
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }
  return parseGwei(parsed.toString())
}

export const getGasOverrides = async (
  client?: PublicClient | null,
): Promise<GasOverrides> => {
  if (!client) {
    return {}
  }

  const maxFeeOverride = parseGweiEnv(process.env.NEXT_PUBLIC_GAS_MAX_FEE_GWEI)
  const priorityOverride = parseGweiEnv(
    process.env.NEXT_PUBLIC_GAS_PRIORITY_FEE_GWEI,
  )

  if (maxFeeOverride && priorityOverride) {
    return {
      maxFeePerGas: maxFeeOverride,
      maxPriorityFeePerGas: priorityOverride,
    }
  }

  const fees = await client.estimateFeesPerGas()
  const multiplier = Number(process.env.NEXT_PUBLIC_GAS_FEE_MULTIPLIER ?? '1')
  const bump = multiplier > 0 ? BigInt(Math.round(multiplier * 100)) : 100n

  return {
    maxFeePerGas:
      maxFeeOverride ?? (fees.maxFeePerGas * bump) / 100n,
    maxPriorityFeePerGas:
      priorityOverride ?? (fees.maxPriorityFeePerGas * bump) / 100n,
  }
}

export const getAgentsByOwner = async (
  client: PublicClient,
  owner: Address,
) : Promise<Address[]> =>
  client.readContract({
    address: AGENT_FACTORY_ADDRESS,
    abi: AGENT_FACTORY_ABI,
    functionName: 'getAgentsByOwner',
    args: [owner],
  }) as Promise<Address[]>

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
  gasOverrides?: GasOverrides,
) => {
  const entryFeeWei = parseEther(entryFeeEth.toString())
  return client.writeContract({
    address: ARENA_ADDRESS,
    abi: ARENA_ABI,
    functionName: 'createBattle',
    args: [challengeType, entryFeeWei, maxAgents, duration],
    value: entryFeeWei,
    ...gasOverrides,
  })
}

export const createAgent = async (
  client: WalletClient,
  bytecode: `0x${string}`,
  gasOverrides?: GasOverrides,
) =>
  client.writeContract({
    address: AGENT_FACTORY_ADDRESS,
    abi: AGENT_FACTORY_ABI,
    functionName: 'createAgent',
    args: [bytecode],
    ...gasOverrides,
  })

export const registerAgent = async (
  client: WalletClient,
  battleId: bigint,
  agentAddress: Address,
  gasOverrides?: GasOverrides,
) =>
  client.writeContract({
    address: ARENA_ADDRESS,
    abi: ARENA_ABI,
    functionName: 'registerAgent',
    args: [battleId, agentAddress],
    ...gasOverrides,
  })

export const registerAgentWithFactory = async (
  client: WalletClient,
  battleId: bigint,
  agentAddress: Address,
  gasOverrides?: GasOverrides,
) =>
  client.writeContract({
    address: AGENT_FACTORY_ADDRESS,
    abi: AGENT_FACTORY_ABI,
    functionName: 'registerAgent',
    args: [battleId, agentAddress],
    ...gasOverrides,
  })

export const startBattle = async (
  client: WalletClient,
  battleId: bigint,
  gasOverrides?: GasOverrides,
) =>
  client.writeContract({
    address: ARENA_ADDRESS,
    abi: ARENA_ABI,
    functionName: 'startBattle',
    args: [battleId],
    ...gasOverrides,
  })

export const resolveBattle = async (
  client: WalletClient,
  battleId: bigint,
  gasOverrides?: GasOverrides,
) =>
  client.writeContract({
    address: ARENA_ADDRESS,
    abi: ARENA_ABI,
    functionName: 'resolveBattle',
    args: [battleId],
    ...gasOverrides,
  })

export const placeBet = async (
  client: WalletClient,
  battleId: bigint,
  agentIndex: bigint,
  amountEth: number,
  gasOverrides?: GasOverrides,
) =>
  client.writeContract({
    address: BETTING_ADDRESS,
    abi: BETTING_ABI,
    functionName: 'placeBet',
    args: [battleId, agentIndex],
    value: parseEther(amountEth.toString()),
    ...gasOverrides,
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
