// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IAgent.sol";
import "./interfaces/IBattle.sol";
import "./interfaces/IAttackRegistry.sol";
import "./challenges/BaseChallenge.sol";

contract Battle is IBattle {
    address public immutable challenge;
    uint256 public immutable entryFee;
    uint256 public immutable deadline;
    address public immutable arena;
    address public immutable creator;
    
    address[] public agents;
    IBattle.BattleState public state;
    address public winner;
    uint256 public winningAmount;
    mapping(address => bool) public hasClaimed;

    event AgentRegistered(address indexed agent);
    event BattleStarted(uint256 timestamp);
    event BattleResolved(address indexed winner, uint256 winningAmount, uint256[] extractions);
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
        challenge = _challenge;
        entryFee = _entryFee;
        deadline = _deadline;
        arena = msg.sender;
        creator = _creator;
        state = IBattle.BattleState.PENDING;
    }

    function registerAgent(address agent) external onlyArena whenState(IBattle.BattleState.PENDING) {
        require(agents.length < 10, "Max agents reached");
        require(IAgent(agent).owner() != address(0), "Invalid agent");
        
        agents.push(agent);
        emit AgentRegistered(agent);
    }

    function startBattle() external onlyArena whenState(IBattle.BattleState.PENDING) {
        require(agents.length >= 2, "Need at least 2 agents");
        state = IBattle.BattleState.ACTIVE;
        emit BattleStarted(block.timestamp);
    }

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

    function claimPrize() external whenState(IBattle.BattleState.RESOLVED) {
        require(msg.sender == winner || msg.sender == IAgent(winner).owner(), "Not winner");
        require(!hasClaimed[winner], "Already claimed");
        
        hasClaimed[winner] = true;
        state = IBattle.BattleState.CLAIMED;
        
        // 70% to winner, 30% to creator/spectators
        uint256 winnerShare = (address(this).balance * 70) / 100;
        uint256 spectatorShare = address(this).balance - winnerShare;
        
        (bool success1, ) = payable(IAgent(winner).owner()).call{value: winnerShare}("");
        require(success1, "Winner transfer failed");
        
        if (spectatorShare > 0) {
            (bool success2, ) = payable(creator).call{value: spectatorShare}("");
            require(success2, "Creator transfer failed");
        }
        
        emit PrizeClaimed(winner, winnerShare);
    }

    function getState() external view returns (IBattle.BattleState) {
        return state;
    }

    function getWinner() external view returns (address) {
        return winner;
    }

    function getAgents() external view returns (address[] memory) {
        return agents;
    }

    function getChallenge() external view returns (address) {
        return challenge;
    }

    receive() external payable {}
}
