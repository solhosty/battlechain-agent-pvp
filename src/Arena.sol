// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Battle.sol";
import "./interfaces/IAgent.sol";
import "./interfaces/IAttackRegistry.sol";
import "./interfaces/IChallengeFactory.sol";

contract Arena {
    uint8 public constant MIN_AGENTS = 2;
    uint8 public constant MAX_AGENTS = 10;
    uint256 public constant MIN_DURATION = 1 hours;
    uint256 public constant MAX_DURATION = 7 days;

    address public immutable attackRegistry;
    address public immutable safeHarbor;
    IChallengeFactory public immutable challengeFactory;
    address public owner;
    bool public paused;
    
    uint256 public nextBattleId;
    mapping(uint256 => address) public battles;
    mapping(address => uint256[]) public creatorBattles;
    bool private locked;

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

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    constructor(
        address _attackRegistry,
        address _safeHarbor,
        address _challengeFactory
    ) {
        owner = msg.sender;
        attackRegistry = _attackRegistry;
        safeHarbor = _safeHarbor;
        challengeFactory = IChallengeFactory(_challengeFactory);
    }

    /// @notice Creates a battle and funds its prize pool from msg.value.
    function createBattle(
        IChallengeFactory.ChallengeType challengeType,
        uint256 entryFee,
        uint8 maxAgents,
        uint256 duration
    ) external payable whenNotPaused returns (uint256 battleId) {
        require(msg.value >= entryFee, "Insufficient entry fee");
        require(maxAgents >= MIN_AGENTS && maxAgents <= MAX_AGENTS, "Invalid agent count");
        require(duration >= MIN_DURATION && duration <= MAX_DURATION, "Invalid duration");

        address challenge = challengeFactory.deployChallenge(challengeType);

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

        newBattle.fundPrizePool{value: msg.value}();
        
        battles[battleId] = address(newBattle);
        creatorBattles[msg.sender].push(battleId);

        emit BattleCreated(battleId, challenge, entryFee, maxAgents);
    }

    /// @notice Registers an agent for a battle.
    function registerAgent(uint256 battleId, address agent)
        external
        whenNotPaused
        nonReentrant
    {
        address battleAddress = battles[battleId];
        require(battleAddress != address(0), "Battle not found");
        
        address challenge = Battle(payable(battleAddress)).getChallenge();
        require(
            IAttackRegistry(attackRegistry).isUnderAttack(challenge),
            "Challenge not in attack mode"
        );

        address agentOwner = _getAgentOwner(agent);
        require(
            msg.sender == agentOwner || msg.sender == agent,
            "Not agent owner"
        );

        Battle(payable(battleAddress)).registerAgent(agent);
        
        emit AgentRegistered(battleId, agent);
    }

    /// @notice Starts a battle once agents are registered.
    function startBattle(uint256 battleId) external whenNotPaused nonReentrant {
        address battleAddress = battles[battleId];
        require(battleAddress != address(0), "Battle not found");
        
        Battle battle = Battle(payable(battleAddress));
        require(msg.sender == battle.creator(), "Only creator");
        address challenge = battle.getChallenge();
        
        require(
            IAttackRegistry(attackRegistry).isUnderAttack(challenge),
            "Challenge not in attack mode"
        );

        battle.startBattle();
        
        emit BattleStarted(battleId);
    }

    /// @notice Resolves a battle after its deadline.
    function resolveBattle(uint256 battleId) external whenNotPaused nonReentrant {
        address battleAddress = battles[battleId];
        require(battleAddress != address(0), "Battle not found");
        
        Battle battle = Battle(payable(battleAddress));
        require(msg.sender == battle.creator(), "Only creator");
        battle.resolveBattle();
        
        emit BattleResolved(battleId, battle.getWinner());
    }

    /// @notice Claims a battle prize on behalf of the winner.
    function claimPrize(uint256 battleId) external whenNotPaused nonReentrant {
        address battleAddress = battles[battleId];
        require(battleAddress != address(0), "Battle not found");
        Battle(payable(battleAddress)).claimPrizeFor(msg.sender);
    }

    /// @notice Pauses or unpauses arena actions.
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    /// @notice Returns the battle address for an id.
    function getBattle(uint256 battleId) external view returns (address) {
        return battles[battleId];
    }

    /// @notice Returns all battle ids created by a creator.
    function getCreatorBattleCount(address creator) external view returns (uint256) {
        return creatorBattles[creator].length;
    }

    /// @notice Returns a single battle id for a creator by index.
    function getCreatorBattleAt(address creator, uint256 index) external view returns (uint256) {
        require(index < creatorBattles[creator].length, "Index out of bounds");
        return creatorBattles[creator][index];
    }

    /// @notice Returns battle ids for a creator with pagination.
    function getCreatorBattles(
        address creator,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory) {
        uint256 total = creatorBattles[creator].length;
        if (offset >= total) {
            return new uint256[](0);
        }
        uint256 available = total - offset;
        uint256 count = available < limit ? available : limit;
        uint256[] memory ids = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = creatorBattles[creator][offset + i];
        }
        return ids;
    }

    /// @notice Returns all battle ids in the arena.
    function getAllBattleIds(uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory)
    {
        uint256 total = nextBattleId;
        if (offset >= total) {
            return new uint256[](0);
        }
        uint256 available = total - offset;
        uint256 count = available < limit ? available : limit;
        uint256[] memory ids = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = offset + i;
        }
        return ids;
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
}
