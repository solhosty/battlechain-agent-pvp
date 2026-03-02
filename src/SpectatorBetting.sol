// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IBattle.sol";

contract SpectatorBetting {
    uint256 public constant ODDS_SCALE = 1e18;
    uint256 public constant MIN_COMMIT_DELAY = 5 minutes;

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
    mapping(uint256 => mapping(address => mapping(bytes32 => uint256))) public betCommits;
    mapping(uint256 => mapping(uint256 => uint256)) public totalWageredPerAgent;
    mapping(uint256 => uint256) public totalPool;
    mapping(uint256 => address[]) public battleAgents;
    mapping(uint256 => uint256) public remainingPool;
    mapping(uint256 => uint256) public remainingWinningWager;
    
    address public arena;
    bool public paused;

    event BetPlaced(
        uint256 indexed battleId,
        address indexed bettor,
        uint256 agentIndex,
        uint256 amount
    );
    event BetCommitted(uint256 indexed battleId, address indexed bettor, bytes32 commitHash);
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

    modifier onlyEOA() {
        require(msg.sender.code.length == 0, "EOA only");
        _;
    }

    constructor(address _arena) {
        arena = _arena;
    }

    /// @notice Registers a battle and its agents for betting.
    function registerBattle(
        uint256 battleId,
        address battleAddress,
        address[] calldata agents,
        uint256 startTime
    ) external onlyArena {
        require(battles[battleId].startTime == 0, "Battle already registered");
        require(battleAddress != address(0), "Invalid battle");
        require(agents.length > 0, "No agents");

        address[] memory canonicalAgents = IBattle(battleAddress).getAgents();
        require(canonicalAgents.length == agents.length, "Agents mismatch");

        for (uint256 i = 0; i < agents.length; i++) {
            address agent = agents[i];
            require(agent != address(0), "Invalid agent");
            require(agent == canonicalAgents[i], "Agents mismatch");
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

    /// @notice Records a bet commitment hash for later reveal.
    function commitBet(uint256 battleId, bytes32 commitHash)
        external
        whenNotPaused
        onlyEOA
    {
        require(commitHash != bytes32(0), "Invalid commit");
        require(battles[battleId].startTime > 0, "Battle not registered");
        require(block.timestamp < battles[battleId].startTime, "Battle started");
        require(
            block.timestamp + MIN_COMMIT_DELAY <= battles[battleId].startTime,
            "Commit too late"
        );
        require(betCommits[battleId][msg.sender][commitHash] == 0, "Commit exists");

        betCommits[battleId][msg.sender][commitHash] = block.timestamp;
        emit BetCommitted(battleId, msg.sender, commitHash);
    }

    /// @notice Reveals a committed bet and adds it to the pool.
    function revealBet(
        uint256 battleId,
        uint256 agentIndex,
        uint256 amount,
        bytes32 salt
    ) external payable whenNotPaused onlyEOA {
        require(amount > 0, "Bet must be positive");
        require(msg.value == amount, "Incorrect value");
        require(battles[battleId].startTime > 0, "Battle not registered");
        require(block.timestamp < battles[battleId].startTime, "Battle started");
        require(agentIndex < battleAgents[battleId].length, "Invalid agent index");

        bytes32 commitHash = getCommitHash(msg.sender, battleId, agentIndex, amount, salt);
        uint256 commitTimestamp = betCommits[battleId][msg.sender][commitHash];
        require(commitTimestamp != 0, "No commit");
        require(block.timestamp >= commitTimestamp + MIN_COMMIT_DELAY, "Commit too recent");

        delete betCommits[battleId][msg.sender][commitHash];

        Bet storage bet = bets[battleId][agentIndex][msg.sender];
        bet.amount += amount;

        totalWageredPerAgent[battleId][agentIndex] += amount;
        totalPool[battleId] += amount;

        emit BetPlaced(battleId, msg.sender, agentIndex, amount);
    }

    /// @notice Legacy bet entrypoint (use commit/reveal instead).
    function placeBet(uint256, uint256) external payable whenNotPaused onlyEOA {
        revert("Use commit-reveal");
    }

    /// @notice Marks a battle as resolved and sets the winning agent index.
    function resolveBets(uint256 battleId, uint256 winningAgentIndex) external onlyArena {
        require(battles[battleId].startTime > 0, "Battle not registered");
        require(!battles[battleId].resolved, "Already resolved");
        require(winningAgentIndex < battleAgents[battleId].length, "Invalid agent index");

        battles[battleId].resolved = true;
        battles[battleId].winningAgentIndex = winningAgentIndex;
        remainingPool[battleId] = totalPool[battleId];
        remainingWinningWager[battleId] = totalWageredPerAgent[battleId][winningAgentIndex];
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
    function claimPayout(uint256 battleId) external whenNotPaused onlyEOA {
        BattleInfo storage battle = battles[battleId];
        require(battle.resolved, "Battle not resolved");

        uint256 winningAgentIndex = battle.winningAgentIndex;
        Bet storage bet = bets[battleId][winningAgentIndex][msg.sender];
        
        require(bet.amount > 0, "No bet placed");
        require(!bet.claimed, "Already claimed");

        uint256 remainingWager = remainingWinningWager[battleId];
        require(remainingWager >= bet.amount, "Invalid wager");

        uint256 payout;
        if (remainingWager == bet.amount) {
            payout = remainingPool[battleId];
            remainingPool[battleId] = 0;
            remainingWinningWager[battleId] = 0;
        } else {
            payout = calculatePayout(battleId, winningAgentIndex, bet.amount);
            remainingPool[battleId] -= payout;
            remainingWinningWager[battleId] -= bet.amount;
        }
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

    /// @notice Computes the commit hash for a bet reveal.
    function getCommitHash(
        address bettor,
        uint256 battleId,
        uint256 agentIndex,
        uint256 amount,
        bytes32 salt
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(bettor, battleId, agentIndex, amount, salt));
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
