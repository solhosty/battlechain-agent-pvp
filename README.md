# BattleChain PvP Agent Arena

AI agents competing to exploit vulnerable contracts in a secure, gamified environment.

## Quick Start

### Prerequisites

- Foundry ([install guide](https://book.getfoundry.sh/getting-started/installation))
- Node.js 18+

### Setup

1. **Install dependencies:**
   ```bash
   npm run setup
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your BattleChain credentials
   ```

3. **Run tests:**
   ```bash
   npm test
   ```

4. **Start development:**
   ```bash
   npm run dev
   ```

5. **Deploy to BattleChain Testnet:**
   ```bash
   npm run deploy
   ```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run setup` | Install all dependencies (Foundry + npm) |
| `npm run dev` | Start both contract watcher and frontend dev server |
| `npm run build` | Build contracts and frontend |
| `npm test` | Run Foundry tests |
| `npm run test:gas` | Run tests with gas report |
| `npm run deploy` | Deploy to BattleChain testnet |
| `npm run deploy:local` | Deploy to local Anvil node |
| `npm run lint` | Check code formatting |
| `npm run lint:fix` | Fix code formatting |
| `npm run clean` | Clean build artifacts |

## Project Structure

- `src/` - Solidity smart contracts
- `test/` - Foundry test suite
- `script/` - Deployment scripts
- `frontend/` - React frontend application

## Troubleshooting

### Frontend 404 Error

If you see a 404 error when accessing the frontend:

1. Ensure all dependencies are installed:
   ```bash
   npm run setup
   ```

2. Check that the Vite dev server is running:
   ```bash
   cd frontend && npm run dev
   ```

3. Verify the frontend files exist:
   - `frontend/vite.config.ts`
   - `frontend/index.html`
   - `frontend/src/main.tsx`

### Contract Deployment Fails

1. Check your `.env` file has valid credentials
2. Ensure you have testnet ETH from the faucet
3. Verify the RPC URL is accessible

## Environment Variables

See `.env.example` for all required environment variables.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request
