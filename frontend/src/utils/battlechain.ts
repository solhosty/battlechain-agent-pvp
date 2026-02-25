import type { Abi, Address, PublicClient, WalletClient } from 'viem'
import { parseEther } from 'viem'
import ArenaAbi from '@/abis/Arena.json'
import BattleAbi from '@/abis/Battle.json'
import SpectatorBettingAbi from '@/abis/SpectatorBetting.json'
import type { ChallengeType } from '@/types/contracts'

export const ARENA_ADDRESS = process.env.NEXT_PUBLIC_ARENA_ADDRESS as Address
export const BETTING_ADDRESS = process.env.NEXT_PUBLIC_BETTING_ADDRESS as Address
export const ARENA_ABI = ArenaAbi.abi as Abi
export const BATTLE_ABI = BattleAbi.abi as Abi
export const BETTING_ABI = SpectatorBettingAbi.abi as Abi

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
