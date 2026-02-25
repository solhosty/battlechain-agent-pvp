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
    mapping(address => bool) public hasClaimed;

    event AgentRegistered(address indexed agent);
    event BattleStarted(uint256 timestamp);
    event BattleResolved(address indexed winner, uint256 winningAmount, uint256[] extractions);
    event PrizePoolFunded(address indexed funder, uint256 amount);
    event PrizeClaimed(address indexed winner, uint256 amount);

    modifier onlyArena() {
        require(msg.sender == arena, "Only arena");
        _;
    }

    modifier whenState(IBattle.BattleState _state) {
        require(state == _state, "Invalid state");
        _;
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
    function registerAgent(address agent) external onlyArena whenState(IBattle.BattleState.PENDING) {
        require(agents.length < maxAgents, "Max agents reached");
        require(IAgent(agent).owner() != address(0), "Invalid agent");
        
        agents.push(agent);
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
        
        for (uint256 i = 0; i < agents.length; i++) {
            uint256 beforeBalance = address(challenge).balance;
            
            try IAgent(agents[i]).attack(address(challenge)) {
                uint256 extracted = beforeBalance - address(challenge).balance;
                extractions[i] = extracted;
                
                if (extracted > highestExtraction) {
                    highestExtraction = extracted;
                    winningAgent = agents[i];
                }
            } catch {
                extractions[i] = 0;
            }
        }
        
        winner = winningAgent;
        winningAmount = highestExtraction;
        state = IBattle.BattleState.RESOLVED;
        
        emit BattleResolved(winner, winningAmount, extractions);
    }

    /// @notice Claims the prize pool for the winning agent or its owner.
    function claimPrize() external whenState(IBattle.BattleState.RESOLVED) {
        require(msg.sender == winner || msg.sender == IAgent(winner).owner(), "Not winner");
        require(!hasClaimed[winner], "Already claimed");
        
        hasClaimed[winner] = true;
        state = IBattle.BattleState.CLAIMED;
        
        uint256 prizePool = address(this).balance;
        uint256 winnerShare = (prizePool * WINNER_SHARE_BPS) / BPS_DENOMINATOR;
        uint256 spectatorShare = prizePool - winnerShare;
        
        (bool success1, ) = payable(IAgent(winner).owner()).call{value: winnerShare}("");
        require(success1, "Winner transfer failed");
        
        if (spectatorShare > 0) {
            (bool success2, ) = payable(creator).call{value: spectatorShare}("");
            require(success2, "Creator transfer failed");
        }
        
        emit PrizeClaimed(winner, winnerShare);
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

    /// @notice Accepts direct prize pool funding.
    receive() external payable {}
}
