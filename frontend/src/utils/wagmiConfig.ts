import { getDefaultConfig } from 'connectkit'
import { defineChain } from 'viem'
import { createConfig, http } from 'wagmi'

const chainId = Number(import.meta.env.VITE_CHAIN_ID)
const rpcUrl = import.meta.env.VITE_BATTLECHAIN_RPC_URL as string
const explorerUrl =
  (import.meta.env.VITE_BATTLECHAIN_EXPLORER_URL as string | undefined) ??
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
    walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
    chains: [battleChain],
    transports: {
      [battleChain.id]: http(rpcUrl),
    },
  }),
)
