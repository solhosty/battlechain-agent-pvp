import { useCallback, useState } from 'react'
import { formatEther, zeroAddress } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
import { ARENA_ABI, ARENA_ADDRESS, BATTLE_ABI } from '../utils/battlechain'
import type { BattleStateLabel, BattleSummary } from '../types/contracts'

const battleStateLabels: BattleStateLabel[] = [
  'Pending',
  'Active',
  'Executing',
  'Resolved',
  'Claimed',
];

export const useBattleChain = () => {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const [battles, setBattles] = useState<BattleSummary[]>([])
  const [loading, setLoading] = useState(false)

  const fetchBattles = useCallback(async () => {
    if (!publicClient) {
      setBattles([])
      return
    }

    setLoading(true)
    try {
      let battleIds: bigint[] = []
      try {
        battleIds = (await publicClient.readContract({
          address: ARENA_ADDRESS,
          abi: ARENA_ABI,
          functionName: 'getAllBattleIds',
        })) as bigint[]
      } catch (error) {
        console.warn('getAllBattleIds not available, using fallback')
      }

      const battleData = await Promise.all(
        battleIds.map(async (id) => {
          const battleAddress = (await publicClient.readContract({
            address: ARENA_ADDRESS,
            abi: ARENA_ABI,
            functionName: 'battles',
            args: [id],
          })) as `0x${string}`

          const [state, challenge, entryFee, deadline, winner] =
            await Promise.all([
              publicClient.readContract({
                address: battleAddress,
                abi: BATTLE_ABI,
                functionName: 'getState',
              }),
              publicClient.readContract({
                address: battleAddress,
                abi: BATTLE_ABI,
                functionName: 'getChallenge',
              }),
              publicClient.readContract({
                address: battleAddress,
                abi: BATTLE_ABI,
                functionName: 'entryFee',
              }),
              publicClient.readContract({
                address: battleAddress,
                abi: BATTLE_ABI,
                functionName: 'deadline',
              }),
              publicClient.readContract({
                address: battleAddress,
                abi: BATTLE_ABI,
                functionName: 'getWinner',
              }),
            ])

          const stateIndex = Number(state)
          return {
            id,
            address: battleAddress,
            state: battleStateLabels[stateIndex] ?? 'Pending',
            challenge: challenge as string,
            entryFee: formatEther(entryFee as bigint),
            deadline: new Date(Number(deadline) * 1000).toLocaleString(),
            winner:
              winner === zeroAddress ? null : (winner as `0x${string}`),
          }
        }),
      )

      setBattles(battleData)
    } catch (error) {
      console.error('Failed to fetch battles:', error)
    } finally {
      setLoading(false)
    }
  }, [publicClient])

  return {
    account: address ?? null,
    isConnected,
    battles,
    loading,
    fetchBattles,
  }
}
