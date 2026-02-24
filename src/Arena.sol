// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Battle.sol";
import "./interfaces/IAttackRegistry.sol";
import "./interfaces/ISafeHarbor.sol";
import "./challenges/BaseChallenge.sol";

contract Arena {
    address public immutable attackRegistry;
    address public immutable safeHarbor;
    address public immutable challengeFactory;
    address public owner;
    bool public paused;
    
    uint256 public nextBattleId;
    mapping(uint256 => address) public battles;
    mapping(address => uint256[]) public creatorBattles;

    event BattleCreated(
        uint256 indexed battleId,
        address indexed challenge,
        uint256 entryFee,
        uint8 maxAgents
    );
    event AgentRegistered(uint256 indexed battleId, address indexed agent);
    event BattleStarted(uint256 indexed battleId);
    event BattleResolved(uint256 indexed battleId, address indexed winner);
    event Paused(bool paused);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }

    constructor(
        address _attackRegistry,
        address _safeHarbor,
        address _challengeFactory
    ) {
        owner = msg.sender;
        attackRegistry = _attackRegistry;
        safeHarbor = _safeHarbor;
        challengeFactory = _challengeFactory;
    }

    function createBattle(
        address challengeType,
        uint256 entryFee,
        uint8 maxAgents,
        uint256 duration
    ) external payable whenNotPaused returns (uint256 battleId) {
        require(msg.value >= entryFee, "Insufficient entry fee");
        require(maxAgents >= 2 && maxAgents <= 10, "Invalid agent count");
        require(duration >= 1 hours && duration <= 7 days, "Invalid duration");

        // Deploy challenge instance
        address challenge = IChallengeFactory(challengeFactory).deployChallenge(challengeType);
        
        // Fund the challenge with entry fee
        (bool success, ) = payable(challenge).call{value: msg.value}("");
        require(success, "Challenge funding failed");

        // Request attack mode via AttackRegistry
        IAttackRegistry(attackRegistry).requestUnderAttack(challenge);

        battleId = nextBattleId++;
        Battle newBattle = new Battle(
            challenge,
            entryFee,
            maxAgents,
            block.timestamp + duration,
            msg.sender
        );
        
        battles[battleId] = address(newBattle);
        creatorBattles[msg.sender].push(battleId);

        emit BattleCreated(battleId, challenge, entryFee, maxAgents);
    }

    function registerAgent(uint256 battleId, address agent) external whenNotPaused {
        require(battles[battleId] != address(0), "Battle not found");
        
        address challenge = Battle(battles[battleId]).getChallenge();
        require(
            IAttackRegistry(attackRegistry).isUnderAttack(challenge),
            "Challenge not in attack mode"
        );

        Battle(battles[battleId]).registerAgent(agent);
        
        emit AgentRegistered(battleId, agent);
    }

    function startBattle(uint256 battleId) external whenNotPaused {
        require(battles[battleId] != address(0), "Battle not found");
        
        Battle battle = Battle(battles[battleId]);
        address challenge = battle.getChallenge();
        
        require(
            IAttackRegistry(attackRegistry).isUnderAttack(challenge),
            "Challenge not in attack mode"
        );

        battle.startBattle();
        
        emit BattleStarted(battleId);
    }

    function resolveBattle(uint256 battleId) external whenNotPaused {
        require(battles[battleId] != address(0), "Battle not found");
        
        Battle battle = Battle(battles[battleId]);
        battle.resolveBattle();
        
        emit BattleResolved(battleId, battle.getWinner());
    }

    function claimPrize(uint256 battleId) external {
        require(battles[battleId] != address(0), "Battle not found");
        Battle(battles[battleId]).claimPrize();
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function getBattle(uint256 battleId) external view returns (address) {
        return battles[battleId];
    }

    function getCreatorBattles(address creator) external view returns (uint256[] memory) {
        return creatorBattles[creator];
    }

    function getAllBattleIds() external view returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](nextBattleId);
        for (uint256 i = 0; i < nextBattleId; i++) {
            ids[i] = i;
        }
        return ids;
    }
}

interface IChallengeFactory {
    function deployChallenge(address challengeType) external returns (address);
}
