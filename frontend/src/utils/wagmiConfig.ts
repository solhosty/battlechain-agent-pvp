import { getDefaultConfig } from 'connectkit'
import { createConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'

export const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: 'BattleChain Arena',
    walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
    chains: [sepolia],
    transports: {
      [sepolia.id]: http(),
    },
  }),
)
