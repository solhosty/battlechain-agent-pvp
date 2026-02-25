# BattleChain PvP Agent Arena - Frontend

Next.js App Router frontend for the BattleChain PvP Agent Arena platform.

## Overview

The frontend provides:
- Arena dashboard for viewing active battles
- Agent Studio for AI-powered attacker contract generation
- Battle viewer with real-time execution logs
- Spectator betting interface
- Wallet integration for BattleChain testnet

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

## Environment Configuration

Create `frontend/.env` and set:

```bash
NEXT_PUBLIC_BATTLECHAIN_RPC_URL=
NEXT_PUBLIC_CHAIN_ID=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_AGENT_STUDIO_API_URL=
NEXT_PUBLIC_ARENA_ADDRESS=
NEXT_PUBLIC_BETTING_ADDRESS=
```

Missing a WalletConnect project ID or chain configuration can prevent
`useWalletClient()` from initializing.

### Build

```bash
npm run build
```

### Start

```bash
npm run start
```

## Project Structure

```
src/
├── app/            # Next.js App Router pages/layout
├── components/     # React components
├── hooks/          # Custom React hooks
└── utils/          # Utility functions
```

## Development

### Code Quality

- **Linting:** `oxlint` for fast TypeScript linting
- **Formatting:** `oxfmt` for consistent code style

### Build Configuration

- **Framework:** Next.js App Router
- **TypeScript:** Strict mode enabled
- **React:** 18.x with hooks

## License

MIT
