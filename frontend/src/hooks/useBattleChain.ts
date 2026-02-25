import { useCallback, useEffect, useRef, useState } from 'react'
import { formatEther, zeroAddress } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
import {
  ARENA_ABI,
  ARENA_ADDRESS,
  BATTLE_ABI,
  getBattleAgents,
} from '../utils/battlechain'
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
  const [creatorBattleIds, setCreatorBattleIds] = useState<bigint[]>([])

  const publicClientRef = useRef(publicClient)
  const accountRef = useRef({ address, isConnected })

  useEffect(() => {
    publicClientRef.current = publicClient
    accountRef.current = { address, isConnected }
  }, [publicClient, address, isConnected])

  const fetchBattles = useCallback(async () => {
    const client = publicClientRef.current
    const { address: currentAddress, isConnected: connected } =
      accountRef.current

    if (!client) {
      setBattles([])
      setCreatorBattleIds([])
      return
    }

    setLoading(true)
    try {
      let battleIds: bigint[] = []
      let needsFallback = false
      try {
        battleIds = (await client.readContract({
          address: ARENA_ADDRESS,
          abi: ARENA_ABI,
          functionName: 'getAllBattleIds',
        })) as bigint[]
      } catch (error) {
        console.warn('getAllBattleIds not available, using fallback')
        needsFallback = true
      }

      if (needsFallback || battleIds.length === 0) {
        try {
          const nextBattleId = (await client.readContract({
            address: ARENA_ADDRESS,
            abi: ARENA_ABI,
            functionName: 'nextBattleId',
          })) as bigint
          const total = Number(nextBattleId)
          battleIds = Array.from({ length: total }, (_, index) =>
            BigInt(index),
          )
        } catch (error) {
          console.warn('nextBattleId fallback not available')
        }
      }

      if (connected && currentAddress) {
        try {
          const creatorIds = (await client.readContract({
            address: ARENA_ADDRESS,
            abi: ARENA_ABI,
            functionName: 'getCreatorBattles',
            args: [currentAddress],
          })) as bigint[]
          setCreatorBattleIds(creatorIds)
        } catch (error) {
          console.warn('getCreatorBattles not available')
          setCreatorBattleIds([])
        }
      } else {
        setCreatorBattleIds([])
      }

      const battleData = await Promise.all(
        battleIds.map(async (id) => {
          const battleAddress = (await client.readContract({
            address: ARENA_ADDRESS,
            abi: ARENA_ABI,
            functionName: 'battles',
            args: [id],
          })) as `0x${string}`

          const [state, challenge, entryFee, deadline, winner] =
            await Promise.all([
              client.readContract({
                address: battleAddress,
                abi: BATTLE_ABI,
                functionName: 'getState',
              }),
              client.readContract({
                address: battleAddress,
                abi: BATTLE_ABI,
                functionName: 'getChallenge',
              }),
              client.readContract({
                address: battleAddress,
                abi: BATTLE_ABI,
                functionName: 'entryFee',
              }),
              client.readContract({
                address: battleAddress,
                abi: BATTLE_ABI,
                functionName: 'deadline',
              }),
              client.readContract({
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
   }, [])

  const fetchBattleAgents = useCallback(
    async (battleAddress: `0x${string}`) => {
      const client = publicClientRef.current
      if (!client) {
        return []
      }

      try {
        return (await getBattleAgents(client, battleAddress)) as
          | `0x${string}`[]
          | []
      } catch (error) {
        console.error('Failed to fetch battle agents:', error)
        return []
      }
    },
    [],
  )

  return {
    account: address ?? null,
    isConnected,
    battles,
    loading,
    creatorBattleIds,
    fetchBattles,
    fetchBattleAgents,
  }
}
