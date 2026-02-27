// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IAgent.sol";
import "./interfaces/IBattle.sol";
import "./interfaces/IAttackRegistry.sol";
import "./challenges/BaseChallenge.sol";

contract Battle is IBattle {
    uint8 public constant MIN_AGENTS = 2;
    uint8 public constant MAX_AGENTS = 10;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant WINNER_SHARE_BPS = 7_000;
    uint256 public constant AGENT_GAS_LIMIT = 200_000;

    address public immutable challenge;
    uint256 public immutable entryFee;
    uint256 public immutable deadline;
    address public immutable arena;
    address public immutable creator;
    uint8 public immutable maxAgents;
    
    address[] public agents;
    IBattle.BattleState public state;
    address public winner;
    uint256 public winningAmount;
    uint256 public prizePool;
    mapping(address => bool) public hasClaimed;
    mapping(address => address) public agentOwner;
    mapping(address => bool) public agentRegistered;
    mapping(address => bool) public ownerRegistered;
    mapping(address => uint256) public s_pendingWithdrawals;
    bool private locked;

    event AgentRegistered(address indexed agent);
    event BattleStarted(uint256 timestamp);
    event BattleResolved(address indexed winner, uint256 winningAmount, uint256[] extractions);
    event PrizePoolFunded(address indexed funder, uint256 amount);
    event PrizeClaimed(address indexed winner, uint256 amount);
    event Withdrawal(address indexed account, uint256 amount);

    modifier onlyArena() {
        require(msg.sender == arena, "Only arena");
        _;
    }

    modifier whenState(IBattle.BattleState _state) {
        require(state == _state, "Invalid state");
        _;
    }

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    constructor(
        address _challenge,
        uint256 _entryFee,
        uint8 _maxAgents,
        uint256 _deadline,
        address _creator
    ) {
        require(_maxAgents >= MIN_AGENTS && _maxAgents <= MAX_AGENTS, "Invalid agent count");
        challenge = _challenge;
        entryFee = _entryFee;
        deadline = _deadline;
        arena = msg.sender;
        creator = _creator;
        maxAgents = _maxAgents;
        state = IBattle.BattleState.PENDING;
    }

    /// @notice Funds the battle prize pool from the arena.
    function fundPrizePool() external payable onlyArena whenState(IBattle.BattleState.PENDING) {
        require(msg.value > 0, "No prize pool");
        emit PrizePoolFunded(msg.sender, msg.value);
    }

    /// @notice Registers an agent for battle execution.
    function registerAgent(address agent)
        external
        onlyArena
        whenState(IBattle.BattleState.PENDING)
        nonReentrant
    {
        require(agents.length < maxAgents, "Max agents reached");
        require(agent != address(0), "Invalid agent");
        require(!agentRegistered[agent], "Agent already registered");

        address owner = _getAgentOwner(agent);
        require(!ownerRegistered[owner], "Owner already registered");

        agents.push(agent);
        agentOwner[agent] = owner;
        agentRegistered[agent] = true;
        ownerRegistered[owner] = true;
        emit AgentRegistered(agent);
    }

    /// @notice Starts the battle once enough agents are registered.
    function startBattle() external onlyArena whenState(IBattle.BattleState.PENDING) {
        require(agents.length >= MIN_AGENTS, "Need at least 2 agents");
        state = IBattle.BattleState.ACTIVE;
        emit BattleStarted(block.timestamp);
    }

    /// @notice Executes each agent and determines the winner.
    function resolveBattle() external onlyArena whenState(IBattle.BattleState.ACTIVE) {
        require(block.timestamp >= deadline, "Battle still active");
        
        state = IBattle.BattleState.EXECUTING;
        
        address winningAgent;
        uint256 highestExtraction;
        uint256[] memory extractions = new uint256[](agents.length);
        bool tie;
        
        for (uint256 i = 0; i < agents.length; i++) {
            uint256 beforeBalance = address(challenge).balance;
            
            try IAgent(agents[i]).attack{gas: AGENT_GAS_LIMIT}(address(challenge)) {
                uint256 afterBalance = address(challenge).balance;
                uint256 extracted = beforeBalance > afterBalance
                    ? beforeBalance - afterBalance
                    : 0;
                extractions[i] = extracted;
                
                if (extracted > highestExtraction) {
                    highestExtraction = extracted;
                    winningAgent = agents[i];
                    tie = false;
                } else if (extracted == highestExtraction && extracted > 0) {
                    tie = true;
                }
            } catch {
                extractions[i] = 0;
            }
        }

        if (tie || highestExtraction == 0) {
            winningAgent = address(0);
        }

        winner = winningAgent;
        winningAmount = highestExtraction;
        state = IBattle.BattleState.RESOLVED;
        prizePool = address(this).balance;
        
        emit BattleResolved(winner, winningAmount, extractions);

        if (winner == address(0)) {
            if (prizePool > 0) {
                s_pendingWithdrawals[creator] += prizePool;
            }
            state = IBattle.BattleState.CLAIMED;
        }
    }

    /// @notice Claims the prize pool for the winning agent or its owner.
    function claimPrize() external whenState(IBattle.BattleState.RESOLVED) nonReentrant {
        _claimPrize(msg.sender);
    }

    /// @notice Claims the prize pool for a winner via the arena.
    function claimPrizeFor(address claimant)
        external
        onlyArena
        whenState(IBattle.BattleState.RESOLVED)
        nonReentrant
    {
        _claimPrize(claimant);
    }

    /// @notice Withdraws any pending balance for the caller.
    function withdraw() external nonReentrant {
        uint256 amount = s_pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending withdrawal");
        s_pendingWithdrawals[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal failed");

        emit Withdrawal(msg.sender, amount);
    }

    /// @notice Returns claimable prize amount for an account.
    function s_agentPrizes(address account) public view returns (uint256) {
        if (state != IBattle.BattleState.RESOLVED) {
            return 0;
        }
        if (winner == address(0)) {
            return 0;
        }
        if (prizePool == 0) {
            return 0;
        }
        if (hasClaimed[winner]) {
            return 0;
        }
        address winnerOwner = agentOwner[winner];
        if (winnerOwner == address(0)) {
            return 0;
        }
        if (account != winner && account != winnerOwner) {
            return 0;
        }
        return (prizePool * WINNER_SHARE_BPS) / BPS_DENOMINATOR;
    }

    /// @notice Returns the current battle state.
    function getState() external view returns (IBattle.BattleState) {
        return state;
    }

    /// @notice Returns the winning agent.
    function getWinner() external view returns (address) {
        return winner;
    }

    /// @notice Returns the registered agent addresses.
    function getAgents() external view returns (address[] memory) {
        return agents;
    }

    /// @notice Returns the challenge contract address.
    function getChallenge() external view returns (address) {
        return challenge;
    }

    function _getAgentOwner(address agent) internal view returns (address) {
        (bool success, bytes memory data) = agent.staticcall(
            abi.encodeWithSelector(IAgent.owner.selector)
        );
        require(success && data.length >= 32, "Invalid agent");
        address owner = abi.decode(data, (address));
        require(owner != address(0), "Invalid agent");
        return owner;
    }

    function _claimPrize(address claimant) internal {
        require(winner != address(0), "No winner");

        address winnerOwner = agentOwner[winner];
        require(winnerOwner != address(0), "Invalid winner");
        require(claimant == winner || claimant == winnerOwner, "Not winner");
        require(!hasClaimed[winner], "Already claimed");
        require(prizePool > 0, "No prize pool");

        uint256 winnerShare = s_agentPrizes(claimant);
        require(winnerShare > 0, "No prize available");

        hasClaimed[winner] = true;
        state = IBattle.BattleState.CLAIMED;

        s_pendingWithdrawals[winnerOwner] += winnerShare;

        uint256 creatorShare = prizePool - winnerShare;
        if (creatorShare > 0) {
            s_pendingWithdrawals[creator] += creatorShare;
        }

        emit PrizeClaimed(winner, winnerShare);
    }

    /// @notice Accepts direct prize pool funding.
    receive() external payable {}
}
