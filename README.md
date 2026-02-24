# BattleChain PvP Agent Arena

AI-generated attacker agents competing to exploit vulnerable smart contracts on BattleChain.

The BattleChain PvP Agent Arena creates a competitive environment where AI-generated attacker agents compete to exploit deliberately vulnerable challenge contracts. The architecture follows a factory pattern with `Arena.sol` as the main entry point, which deploys `Battle` instances that execute agents against challenges. Key integration points include BattleChain's `AttackRegistry` for state validation (contracts must be in `UNDER_ATTACK` state before battle execution) and Safe Harbor protection for participants. The system uses entry fees to fund prize pools (70% to winner, 30% to spectators), with all major actions emitting events for frontend tracking. The design prioritizes security with reentrancy guards, access control, and emergency pause functionality.

## Quick Start

### Prerequisites

- Foundry
- Node.js 18+
- BattleChain Testnet access

### Setup

1. **Clone and install dependencies:**
   ```bash
   forge install && npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Compile contracts:**
   ```bash
   forge build
   ```

4. **Deploy to BattleChain testnet:**
   ```bash
   forge script script/Deploy.s.sol --rpc-url $BATTLECHAIN_RPC_URL --broadcast
   ```

## Developer Workflow & Setup

### Prerequisites Installation

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install Node.js dependencies
npm install
```

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Add your BattleChain testnet credentials
BATTLECHAIN_RPC_URL=https://testnet.battlechain.com/rpc
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_battlechain_api_key
```

### Development Commands

```bash
# Compile contracts
forge build

# Run tests
forge test -vvv

# Deploy to BattleChain testnet
forge script script/Deploy.s.sol --rpc-url $BATTLECHAIN_RPC_URL --broadcast --verify

# Start frontend dev server
npm run dev
```

### Getting Started Steps

1. **Configure AI tools with BattleChain context** - Add the prompt from docs to your AI assistant
2. **Set up Safe Harbor for your contracts** - Register with BattleChain's Safe Harbor for protection
3. **Deploy Arena contract to testnet** - Use the deployment script
4. **Create your first challenge** - Deploy a ReentrancyVault challenge
5. **Use Agent Studio to generate an attacker contract** - AI-powered agent generation
6. **Register and battle!** - Compete with other agents

## Architecture

### Core Components

- **Arena.sol** - Main factory contract that creates battles
- **Battle.sol** - Individual battle instance managing agents and resolution
- **ReentrancyVault.sol** - Example vulnerable challenge contract
- **ChallengeFactory.sol** - Factory for deploying challenge instances
- **SpectatorBetting.sol** - Betting and prize distribution

### Integration Points

- **AttackRegistry** - Validates contracts are in `UNDER_ATTACK` state before battle
- **Safe Harbor** - Protects participants during battle execution

### Prize Distribution

- **70%** to winner
- **30%** to creator/spectators

### Security Features

- Reentrancy guards
- Access control modifiers
- Emergency pause functionality
- Event emission for all major actions

## Testing Strategy

```bash
# Install dependencies and setup Foundry
forge install

# Run all tests
forge test

# Run tests with verbosity for detailed output
forge test -vvv

# Test specific battle mechanics
forge test --match-test testBattleResolution -vvv

# Test reentrancy vulnerability exploitation
forge test --match-test testReentrancyExploit -vvv

# Test spectator betting odds calculation
forge test --match-test testBettingPayoutCalculation -vvv

# Run gas report
forge test --gas-report
```

## Demo Script for Thursday Presentation

### Demo Flow

#### 1. Show deployed Arena contract on BattleChain explorer
- Navigate to the Arena contract address on BattleChain Testnet explorer
- Display the contract source code and verified status
- Show current battle count and active challenges

#### 2. Display Agent Studio generating an attacker contract
- Open the Agent Studio interface
- Enter AI prompt: "Create a reentrancy attacker that exploits a vault using checks-effects-interactions violation"
- Show real-time code generation with syntax highlighting
- Display compilation status indicator turning green

#### 3. Register two agents and start battle
- Deploy first agent via Agent Studio one-click deploy
- Deploy second agent with different strategy
- Use Arena.registerAgent() to add both agents to battle
- Execute Arena.startBattle() to initiate Safe Harbor attack mode

#### 4. Show execution results and winner determination
- Display Battle.resolveBattle() transaction
- Show agent execution logs with extraction amounts
- Reveal winner address and winning amount
- Display battle state change to RESOLVED

#### 5. Demonstrate prize distribution and spectator payouts
- Show winner claiming 70% prize via Arena.claimPrize()
- Display spectator betting contract with payout calculations
- Execute bet settlements for winning spectators
- Show final balances and transaction confirmations

## Contract Addresses (Testnet)

| Contract | Address |
|----------|---------|
| Arena | TBD |
| AttackRegistry | `0x0000000000000000000000000000000000000000` |
| SafeHarbor | `0x0000000000000000000000000000000000000000` |

## Documentation

- [Frontend Documentation](frontend/README.md)
- [Contract Interfaces](src/interfaces/)
- [Challenge Examples](src/challenges/)

## License

MIT
