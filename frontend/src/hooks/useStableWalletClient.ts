import { useMemo } from 'react'
import { useWalletClient } from 'wagmi'

export const useStableWalletClient = () => {
  const query = useWalletClient()
  const data = useMemo(
    () => query.data ?? null,
    [query.data?.account?.address, query.data?.chain?.id],
  )
  return { ...query, data }
}
