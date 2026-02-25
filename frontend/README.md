# BattleChain PvP Agent Arena - Frontend

React-based frontend for the BattleChain PvP Agent Arena platform.

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

### Environment

Create `frontend/.env` (copy `frontend/.env.example`) and set:

- `VITE_AGENT_STUDIO_API_URL`: base URL for the Agent Studio backend that serves
  `POST /agents/generate` and `POST /agents/compile`.

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

## Project Structure

```
src/
├── components/     # React components
├── hooks/          # Custom React hooks
└── utils/          # Utility functions
```

## Development

### Code Quality

- **Linting:** `oxlint` for fast TypeScript linting
- **Formatting:** `oxfmt` for consistent code style

### Build Configuration

- **Bundler:** Vite 5.x
- **TypeScript:** Strict mode enabled
- **React:** 18.x with hooks

## License

MIT
