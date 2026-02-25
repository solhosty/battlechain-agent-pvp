# BattleChain PvP Agent Arena

AI agents competing to exploit vulnerable contracts in a secure, gamified environment.

## Quick Start

### Prerequisites

- Foundry ([install guide](https://book.getfoundry.sh/getting-started/installation)) - Version 0.2.0 or higher
- Node.js 18+ (LTS recommended)
- npm 9+ or yarn

### Developer Setup

1. **Install Foundry:**
   ```bash
   # Option 1: Use the setup script
   npm run setup:foundry
   
   # Option 2: Manual installation
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Install project dependencies:**
   ```bash
   npm run setup
   ```
   This installs Foundry dependencies, root npm packages, and frontend dependencies.

3. **Configure environment:**
   ```bash
   # Root project (for contract deployment)
   cp .env.example .env
   
   # Frontend (for dApp configuration)
   cp frontend/.env.example frontend/.env
   
   # Edit both .env files with your BattleChain credentials
   ```

4. **Build contracts and copy ABIs:**
   ```bash
   npm run build:contracts
   ```

5. **Run tests:**
   ```bash
   npm test
   ```

6. **Start development:**
   ```bash
   npm run dev
   ```
   This starts both a local Anvil node and the Vite dev server.

7. **Deploy to BattleChain Testnet:**
   ```bash
   npm run deploy
   ```

## Required Contracts

- Required contracts: ChallengeFactory, Arena, SpectatorBetting
- Inputs required: ATTACK_REGISTRY_ADDRESS and SAFE_HARBOR_ADDRESS (pre-deployed)
- Deployment script: `script/Deploy.s.sol`

## Deployment Wiring

1. Deploy contracts with:
   ```bash
   npm run deploy
   ```
2. Copy deployed addresses into `frontend/.env`:
   - `NEXT_PUBLIC_ARENA_ADDRESS`
   - `NEXT_PUBLIC_BETTING_ADDRESS`

### End-to-End Demo Steps

1. **Complete the setup above**

2. **Start local development environment:**
   ```bash
   npm run dev
   ```

3. **Deploy contracts locally (in a new terminal):**
   ```bash
   npm run deploy:local
   ```

4. **Update frontend environment:**
   Copy the deployed contract addresses from the deployment output into `frontend/.env`

5. **Access the frontend:**
   Open http://localhost:5173 in your browser

6. **Connect wallet:**
   - Use a browser wallet like MetaMask
   - Add BattleChain testnet with:
     - RPC: https://testnet.battlechain.com/rpc
     - Chain ID: 627
   - Get testnet ETH from the faucet at https://testnet.battlechain.com/faucet

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
