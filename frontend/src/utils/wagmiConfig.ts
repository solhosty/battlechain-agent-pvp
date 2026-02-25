import { getDefaultConfig } from 'connectkit'
import { defineChain } from 'viem'
import { createConfig, http } from 'wagmi'

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID)
const rpcUrl = process.env.NEXT_PUBLIC_BATTLECHAIN_RPC_URL as string
const explorerUrl =
  (process.env.NEXT_PUBLIC_BATTLECHAIN_EXPLORER_URL as string | undefined) ??
  'https://testnet.battlechain.com'

const battleChain = defineChain({
  id: chainId,
  name: 'BattleChain Testnet',
  nativeCurrency: {
    name: 'BattleChain',
    symbol: 'BATTLE',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'BattleChain Explorer',
      url: explorerUrl,
    },
  },
})

export const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: 'BattleChain Arena',
    walletConnectProjectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID as string,
    chains: [battleChain],
    transports: {
      [battleChain.id]: http(rpcUrl),
    },
  }),
)
