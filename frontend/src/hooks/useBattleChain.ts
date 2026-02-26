import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatEther, zeroAddress } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
import {
  ARENA_ABI,
  ARENA_ADDRESS,
  BATTLE_ABI,
  ARENA_PAGINATION_ABI,
  BET_CLAIMED_EVENT,
  BETTING_ADDRESS,
  PRIZE_CLAIMED_EVENT,
  getAgentOwner,
  getBetForWinner,
  getBattleAgents,
  getClaimableBetPayout,
  getClaimablePrize,
  getPendingWithdrawal,
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
  const [claimablePrizesByBattle, setClaimablePrizesByBattle] = useState<
    Record<string, bigint>
  >({})
  const [pendingWithdrawalsByBattle, setPendingWithdrawalsByBattle] = useState<
    Record<string, bigint>
  >({})
  const [betPayoutsByBattle, setBetPayoutsByBattle] = useState<
    Record<string, bigint>
  >({})
  const [participationByBattle, setParticipationByBattle] = useState<
    Record<string, { asOwner: boolean; asBettor: boolean; betClaimed: boolean }>
  >({})

  const publicClientRef = useRef(publicClient)
  const accountRef = useRef({ address, isConnected })
  const battlesRef = useRef<BattleSummary[]>([])

  useEffect(() => {
    publicClientRef.current = publicClient
    accountRef.current = { address, isConnected }
  }, [publicClient, address, isConnected])

  useEffect(() => {
    battlesRef.current = battles
  }, [battles])

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
        let creatorIds: bigint[] = []
        try {
          const count = (await client.readContract({
            address: ARENA_ADDRESS,
            abi: ARENA_PAGINATION_ABI,
            functionName: 'getCreatorBattleCount',
            args: [currentAddress],
          })) as bigint
          const pageSize = 25n
          for (let offset = 0n; offset < count; offset += pageSize) {
            const page = (await client.readContract({
              address: ARENA_ADDRESS,
              abi: ARENA_PAGINATION_ABI,
              functionName: 'getCreatorBattles',
              args: [currentAddress, offset, pageSize],
            })) as bigint[]
            creatorIds = [...creatorIds, ...page]
          }
        } catch (error) {
          console.warn('getCreatorBattles pagination not available')
        }

        if (creatorIds.length === 0) {
          try {
            const fallback = (await client.readContract({
              address: ARENA_ADDRESS,
              abi: ARENA_ABI,
              functionName: 'getCreatorBattles',
              args: [currentAddress],
            })) as bigint[]
            creatorIds = fallback
          } catch (error) {
            console.warn('getCreatorBattles fallback not available')
          }
        }

        setCreatorBattleIds(creatorIds)
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

  const refreshClaimables = useCallback(async () => {
    const client = publicClientRef.current
    const { address: currentAddress, isConnected: connected } =
      accountRef.current

    if (!client || !connected || !currentAddress) {
      setClaimablePrizesByBattle({})
      setPendingWithdrawalsByBattle({})
      setBetPayoutsByBattle({})
      setParticipationByBattle({})
      return
    }

    const prizeMap: Record<string, bigint> = {}
    const pendingMap: Record<string, bigint> = {}
    const betMap: Record<string, bigint> = {}
    const participation: Record<
      string,
      { asOwner: boolean; asBettor: boolean; betClaimed: boolean }
    > = {}

    const normalize = (value: string) => value.toLowerCase()
    const resolvedBattles = battlesRef.current.filter(
      (battle) => battle.state === 'Resolved' || battle.state === 'Claimed',
    )

    await Promise.all(
      resolvedBattles.map(async (battle) => {
        const battleAddress = battle.address as `0x${string}`
        const battleId = battle.id
        try {
          const [claimablePrize, pendingWithdrawal, betPayout, betStatus] =
            await Promise.all([
              getClaimablePrize(client, battleAddress, currentAddress),
              getPendingWithdrawal(client, battleAddress, currentAddress),
              getClaimableBetPayout(client, battleId, currentAddress),
              getBetForWinner(client, battleId, currentAddress),
            ])

          const betAmount = betStatus.amount
          const betClaimed = betStatus.claimed
          const asBettor = betAmount > 0n

          let asOwner = false
          try {
            const agents = (await getBattleAgents(
              client,
              battleAddress,
            )) as `0x${string}`[]
            const owners = await Promise.all(
              agents.map((agent) =>
                getAgentOwner(client, battleAddress, agent),
              ),
            )
            asOwner = owners.some(
              (owner) => normalize(owner) === normalize(currentAddress),
            )
          } catch (error) {
            asOwner = false
          }

          prizeMap[battleId.toString()] = claimablePrize as bigint
          pendingMap[battleId.toString()] = pendingWithdrawal as bigint
          betMap[battleId.toString()] = betPayout as bigint
          participation[battleId.toString()] = {
            asOwner,
            asBettor,
            betClaimed,
          }
        } catch (error) {
          prizeMap[battleId.toString()] = 0n
          pendingMap[battleId.toString()] = 0n
          betMap[battleId.toString()] = 0n
        }
      }),
    )

    setClaimablePrizesByBattle(prizeMap)
    setPendingWithdrawalsByBattle(pendingMap)
    setBetPayoutsByBattle(betMap)
    setParticipationByBattle(participation)
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

  useEffect(() => {
    refreshClaimables()
  }, [refreshClaimables, battles, address])

  useEffect(() => {
    const client = publicClient
    if (!client || !address) {
      return undefined
    }

    const unwatchers: Array<() => void> = []

    for (const battle of battles) {
      const battleAddress = battle.address as `0x${string}`
      const unwatch = client.watchContractEvent({
        address: battleAddress,
        event: PRIZE_CLAIMED_EVENT,
        onLogs: () => refreshClaimables(),
      })
      unwatchers.push(unwatch)
    }

    const unwatchBet = client.watchContractEvent({
      address: BETTING_ADDRESS,
      event: BET_CLAIMED_EVENT,
      onLogs: () => refreshClaimables(),
    })
    unwatchers.push(unwatchBet)

    return () => {
      unwatchers.forEach((unwatch) => unwatch())
    }
  }, [address, battles, publicClient, refreshClaimables])

  const claimablePrizeTotal = useMemo(
    () =>
      Object.values(claimablePrizesByBattle).reduce(
        (total, value) => total + value,
        0n,
      ),
    [claimablePrizesByBattle],
  )

  const pendingWithdrawalTotal = useMemo(
    () =>
      Object.values(pendingWithdrawalsByBattle).reduce(
        (total, value) => total + value,
        0n,
      ),
    [pendingWithdrawalsByBattle],
  )

  const claimableBetTotal = useMemo(
    () =>
      Object.values(betPayoutsByBattle).reduce(
        (total, value) => total + value,
        0n,
      ),
    [betPayoutsByBattle],
  )

  return {
    account: address ?? null,
    isConnected,
    battles,
    loading,
    creatorBattleIds,
    claimablePrizesByBattle,
    pendingWithdrawalsByBattle,
    betPayoutsByBattle,
    participationByBattle,
    claimablePrizeTotal,
    pendingWithdrawalTotal,
    claimableBetTotal,
    fetchBattles,
    fetchBattleAgents,
  }
}
