// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IBattle.sol";

contract SpectatorBetting {
    uint256 public constant ODDS_SCALE = 1e18;

    struct Bet {
        uint256 amount;
        bool claimed;
    }

    struct BattleInfo {
        uint256 startTime;
        bool resolved;
        uint256 winningAgentIndex;
    }

    mapping(uint256 => BattleInfo) public battles;
    mapping(uint256 => mapping(uint256 => mapping(address => Bet))) public bets;
    mapping(uint256 => mapping(uint256 => uint256)) public totalWageredPerAgent;
    mapping(uint256 => uint256) public totalPool;
    mapping(uint256 => address[]) public battleAgents;
    
    address public arena;
    bool public paused;

    event BetPlaced(
        uint256 indexed battleId,
        address indexed bettor,
        uint256 agentIndex,
        uint256 amount
    );
    event BetClaimed(
        uint256 indexed battleId,
        address indexed bettor,
        uint256 payout
    );
    event BattleRegistered(uint256 indexed battleId, address[] agents);
    event BetsResolved(uint256 indexed battleId, uint256 winningAgentIndex);
    event Paused(bool paused);

    modifier onlyArena() {
        require(msg.sender == arena, "Only arena");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }

    constructor(address _arena) {
        arena = _arena;
    }

    /// @notice Registers a battle and its agents for betting.
    function registerBattle(
        uint256 battleId,
        address[] calldata agents,
        uint256 startTime
    ) external onlyArena {
        require(battles[battleId].startTime == 0, "Battle already registered");
        require(agents.length > 0, "No agents");

        for (uint256 i = 0; i < agents.length; i++) {
            address agent = agents[i];
            require(agent != address(0), "Invalid agent");
            for (uint256 j = i + 1; j < agents.length; j++) {
                require(agent != agents[j], "Duplicate agent");
            }
        }
        
        battles[battleId] = BattleInfo({
            startTime: startTime,
            resolved: false,
            winningAgentIndex: 0
        });
        battleAgents[battleId] = agents;
        
        emit BattleRegistered(battleId, agents);
    }

    /// @notice Places a bet on a specific agent for a battle.
    function placeBet(uint256 battleId, uint256 agentIndex) external payable whenNotPaused {
        require(msg.value > 0, "Bet must be positive");
        require(battles[battleId].startTime > 0, "Battle not registered");
        require(block.timestamp < battles[battleId].startTime, "Battle started");
        require(agentIndex < battleAgents[battleId].length, "Invalid agent index");

        Bet storage bet = bets[battleId][agentIndex][msg.sender];
        bet.amount += msg.value;

        totalWageredPerAgent[battleId][agentIndex] += msg.value;
        totalPool[battleId] += msg.value;

        emit BetPlaced(battleId, msg.sender, agentIndex, msg.value);
    }

    /// @notice Marks a battle as resolved and sets the winning agent index.
    function resolveBets(uint256 battleId, uint256 winningAgentIndex) external onlyArena {
        require(battles[battleId].startTime > 0, "Battle not registered");
        require(!battles[battleId].resolved, "Already resolved");
        require(winningAgentIndex < battleAgents[battleId].length, "Invalid agent index");

        battles[battleId].resolved = true;
        battles[battleId].winningAgentIndex = winningAgentIndex;
        emit BetsResolved(battleId, winningAgentIndex);
    }

    /// @notice Calculates a payout for a given bet.
    function calculatePayout(
        uint256 battleId,
        uint256 agentIndex,
        uint256 betAmount
    ) public view returns (uint256) {
        uint256 winningPool = totalWageredPerAgent[battleId][agentIndex];
        if (winningPool == 0) return 0;

        uint256 loserPool = totalPool[battleId] - winningPool;
        return betAmount + ((betAmount * loserPool) / winningPool);
    }

    /// @notice Claims payout for the winning agent bet.
    function claimPayout(uint256 battleId) external whenNotPaused {
        BattleInfo storage battle = battles[battleId];
        require(battle.resolved, "Battle not resolved");

        uint256 winningAgentIndex = battle.winningAgentIndex;
        Bet storage bet = bets[battleId][winningAgentIndex][msg.sender];
        
        require(bet.amount > 0, "No bet placed");
        require(!bet.claimed, "Already claimed");

        uint256 payout = calculatePayout(battleId, winningAgentIndex, bet.amount);
        bet.claimed = true;

        (bool success, ) = payable(msg.sender).call{value: payout}("");
        require(success, "Payout failed");

        emit BetClaimed(battleId, msg.sender, payout);
    }

    /// @notice Returns claimable payout for a bettor on a battle.
    function s_betPayouts(address bettor, uint256 battleId) external view returns (uint256) {
        BattleInfo storage battle = battles[battleId];
        if (!battle.resolved) {
            return 0;
        }
        uint256 winningAgentIndex = battle.winningAgentIndex;
        Bet storage bet = bets[battleId][winningAgentIndex][bettor];
        if (bet.amount == 0 || bet.claimed) {
            return 0;
        }
        return calculatePayout(battleId, winningAgentIndex, bet.amount);
    }

    /// @notice Returns the current odds for an agent in a battle.
    function getOdds(uint256 battleId, uint256 agentIndex) external view returns (uint256) {
        uint256 agentPool = totalWageredPerAgent[battleId][agentIndex];
        if (agentPool == 0) return 0;
        
        return (totalPool[battleId] * ODDS_SCALE) / agentPool;
    }

    /// @notice Pauses or unpauses betting.
    function setPaused(bool _paused) external {
        require(msg.sender == arena, "Only arena");
        paused = _paused;
        emit Paused(_paused);
    }

    /// @notice Accepts direct ether transfers.
    receive() external payable {}
}
