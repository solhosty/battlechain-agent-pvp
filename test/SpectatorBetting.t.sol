// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/SpectatorBetting.sol";

contract MockBattle {
    address[] private agents;

    constructor(address[] memory _agents) {
        for (uint256 i = 0; i < _agents.length; i++) {
            agents.push(_agents[i]);
        }
    }

    function getAgents() external view returns (address[] memory) {
        return agents;
    }
}

contract BettingCaller {
    function commitBet(address bettingAddress, uint256 battleId, bytes32 commitHash) external {
        SpectatorBetting(bettingAddress).commitBet(battleId, commitHash);
    }
}

contract SpectatorBettingTest is Test {
    SpectatorBetting public betting;
    MockBattle public battle;
    
    address public arena = address(1);
    address public spectator1 = address(2);
    address public spectator2 = address(3);
    address public spectator3 = address(4);
    
    uint256 public constant BATTLE_ID = 0;
    uint256 public constant START_TIME = 1000;

    function setUp() public {
        betting = new SpectatorBetting(arena);
        
        // Register a battle with 3 agents
        address[] memory agents = new address[](3);
        agents[0] = address(10);
        agents[1] = address(11);
        agents[2] = address(12);

        battle = new MockBattle(agents);
        
        vm.prank(arena);
        betting.registerBattle(BATTLE_ID, address(battle), agents, START_TIME);
    }

    function _commit(
        address bettor,
        uint256 agentIndex,
        uint256 amount,
        bytes32 salt
    ) internal {
        bytes32 commitHash = betting.getCommitHash(
            bettor,
            BATTLE_ID,
            agentIndex,
            amount,
            salt
        );
        vm.prank(bettor);
        betting.commitBet(BATTLE_ID, commitHash);
    }

    function _reveal(
        address bettor,
        uint256 agentIndex,
        uint256 amount,
        bytes32 salt
    ) internal {
        vm.prank(bettor);
        betting.revealBet{value: amount}(BATTLE_ID, agentIndex, amount, salt);
    }

    function testPlaceBet() public {
        vm.deal(spectator1, 2 ether);
        uint256 delay = betting.MIN_COMMIT_DELAY();
        bytes32 salt = bytes32(uint256(1));
        vm.warp(START_TIME - delay - 1);

        _commit(spectator1, 0, 1 ether, salt);

        vm.warp(START_TIME - 1);
        _reveal(spectator1, 0, 1 ether, salt);
        
        (uint256 amount, bool claimed) = betting.bets(BATTLE_ID, 0, spectator1);
        assertEq(amount, 1 ether);
        assertFalse(claimed);
        assertEq(betting.totalWageredPerAgent(BATTLE_ID, 0), 1 ether);
        assertEq(betting.totalPool(BATTLE_ID), 1 ether);
    }

    function testPlaceBetBattleStarted() public {
        vm.deal(spectator1, 2 ether);
        uint256 delay = betting.MIN_COMMIT_DELAY();
        bytes32 salt = bytes32(uint256(2));
        vm.warp(START_TIME - delay - 1);
        _commit(spectator1, 0, 1 ether, salt);

        vm.warp(START_TIME + 1);
        vm.expectRevert("Battle started");
        _reveal(spectator1, 0, 1 ether, salt);
    }

    function testPlaceBetInvalidAgent() public {
        vm.deal(spectator1, 2 ether);
        uint256 delay = betting.MIN_COMMIT_DELAY();
        bytes32 salt = bytes32(uint256(3));
        vm.warp(START_TIME - delay - 1);
        _commit(spectator1, 10, 1 ether, salt);

        vm.warp(START_TIME - 1);
        vm.expectRevert("Invalid agent index");
        _reveal(spectator1, 10, 1 ether, salt);
    }

    function testRevealWithoutCommitReverts() public {
        vm.deal(spectator1, 2 ether);
        vm.warp(START_TIME - 1);

        vm.prank(spectator1);
        vm.expectRevert("No commit");
        betting.revealBet{value: 1 ether}(BATTLE_ID, 0, 1 ether, bytes32(uint256(18)));
    }

    function testRevealInvalidCommitReverts() public {
        vm.deal(spectator1, 2 ether);
        uint256 delay = betting.MIN_COMMIT_DELAY();
        bytes32 salt = bytes32(uint256(19));
        bytes32 wrongSalt = bytes32(uint256(20));
        vm.warp(START_TIME - delay - 1);
        _commit(spectator1, 0, 1 ether, salt);

        vm.warp(START_TIME - 1);
        vm.expectRevert("No commit");
        _reveal(spectator1, 0, 1 ether, wrongSalt);
    }

    function testRevealTooSoonReverts() public {
        vm.deal(spectator1, 2 ether);
        uint256 delay = betting.MIN_COMMIT_DELAY();
        bytes32 salt = bytes32(uint256(21));
        uint256 commitTime = START_TIME - delay - 1;
        vm.warp(commitTime);
        _commit(spectator1, 0, 1 ether, salt);

        vm.warp(commitTime + 1);
        vm.expectRevert("Commit too recent");
        _reveal(spectator1, 0, 1 ether, salt);
    }

    function testCalculatePayout() public {
        vm.deal(spectator1, 3 ether);
        vm.deal(spectator2, 3 ether);
        vm.deal(spectator3, 3 ether);
        uint256 delay = betting.MIN_COMMIT_DELAY();
        bytes32 salt1 = bytes32(uint256(4));
        bytes32 salt2 = bytes32(uint256(5));
        vm.warp(START_TIME - delay - 1);
        
        // Place bets: 1 ether on agent 0, 2 ether on agent 1
        _commit(spectator1, 0, 1 ether, salt1);
        _commit(spectator2, 1, 2 ether, salt2);

        vm.warp(START_TIME - 1);
        _reveal(spectator1, 0, 1 ether, salt1);
        _reveal(spectator2, 1, 2 ether, salt2);
        
        // Total pool = 3 ether
        // If agent 0 wins: payout = 1 + (1 * 2 / 1) = 3 ether
        uint256 payout = betting.calculatePayout(BATTLE_ID, 0, 1 ether);
        assertEq(payout, 3 ether);
        
        // If agent 1 wins: payout = 2 + (2 * 1 / 2) = 3 ether
        payout = betting.calculatePayout(BATTLE_ID, 1, 2 ether);
        assertEq(payout, 3 ether);
    }

    function testClaimPayout() public {
        vm.deal(spectator1, 3 ether);
        vm.deal(spectator2, 3 ether);
        uint256 delay = betting.MIN_COMMIT_DELAY();
        bytes32 salt1 = bytes32(uint256(6));
        bytes32 salt2 = bytes32(uint256(7));
        vm.warp(START_TIME - delay - 1);
        
        // Place bets
        _commit(spectator1, 0, 1 ether, salt1);
        _commit(spectator2, 1, 2 ether, salt2);

        vm.warp(START_TIME - 1);
        _reveal(spectator1, 0, 1 ether, salt1);
        _reveal(spectator2, 1, 2 ether, salt2);
        
        // Resolve battle - agent 0 wins
        vm.prank(arena);
        betting.resolveBets(BATTLE_ID, 0);
        
        // Fund betting contract
        vm.deal(address(betting), 3 ether);
        
        uint256 initialBalance = spectator1.balance;
        
        // Claim payout
        vm.prank(spectator1);
        betting.claimPayout(BATTLE_ID);
        
        // Payout should be 3 ether (original 1 + 2 from loser pool)
        assertEq(spectator1.balance - initialBalance, 3 ether);
        
        (uint256 amount, bool claimed) = betting.bets(BATTLE_ID, 0, spectator1);
        assertTrue(claimed);
    }

    function testClaimPayoutNotResolved() public {
        vm.deal(spectator1, 2 ether);
        uint256 delay = betting.MIN_COMMIT_DELAY();
        bytes32 salt = bytes32(uint256(8));
        vm.warp(START_TIME - delay - 1);
        _commit(spectator1, 0, 1 ether, salt);

        vm.warp(START_TIME - 1);
        _reveal(spectator1, 0, 1 ether, salt);
        
        vm.prank(spectator1);
        vm.expectRevert("Battle not resolved");
        betting.claimPayout(BATTLE_ID);
    }

    function testClaimPayoutNoBet() public {
        vm.prank(arena);
        betting.resolveBets(BATTLE_ID, 0);
        
        vm.prank(spectator1);
        vm.expectRevert("No bet placed");
        betting.claimPayout(BATTLE_ID);
    }

    function testClaimPayoutAlreadyClaimed() public {
        vm.deal(spectator1, 2 ether);
        uint256 delay = betting.MIN_COMMIT_DELAY();
        bytes32 salt = bytes32(uint256(9));
        vm.warp(START_TIME - delay - 1);
        _commit(spectator1, 0, 1 ether, salt);

        vm.warp(START_TIME - 1);
        _reveal(spectator1, 0, 1 ether, salt);
        
        vm.prank(arena);
        betting.resolveBets(BATTLE_ID, 0);
        
        vm.deal(address(betting), 2 ether);
        
        vm.startPrank(spectator1);
        betting.claimPayout(BATTLE_ID);
        
        vm.expectRevert("Already claimed");
        betting.claimPayout(BATTLE_ID);
        vm.stopPrank();
    }

    function testClaimPayoutDustGoesToLastClaimer() public {
        vm.deal(spectator1, 2 ether);
        vm.deal(spectator2, 2 ether);
        vm.deal(spectator3, 2 ether);
        uint256 delay = betting.MIN_COMMIT_DELAY();
        bytes32 salt1 = bytes32(uint256(10));
        bytes32 salt2 = bytes32(uint256(11));
        bytes32 salt3 = bytes32(uint256(12));
        vm.warp(START_TIME - delay - 1);

        _commit(spectator1, 0, 1 ether, salt1);
        _commit(spectator2, 0, 1 ether, salt2);
        _commit(spectator3, 1, 1 ether, salt3);

        vm.warp(START_TIME - 1);
        _reveal(spectator1, 0, 1 ether, salt1);
        _reveal(spectator2, 0, 1 ether, salt2);
        _reveal(spectator3, 1, 1 ether, salt3);

        vm.prank(arena);
        betting.resolveBets(BATTLE_ID, 0);

        uint256 firstBalance = spectator1.balance;
        uint256 secondBalance = spectator2.balance;

        vm.prank(spectator1);
        betting.claimPayout(BATTLE_ID);
        assertEq(spectator1.balance - firstBalance, 1 ether);

        vm.prank(spectator2);
        betting.claimPayout(BATTLE_ID);
        assertEq(spectator2.balance - secondBalance, 2 ether);
    }

    function testGetOdds() public {
        vm.deal(spectator1, 3 ether);
        vm.deal(spectator2, 3 ether);
        uint256 delay = betting.MIN_COMMIT_DELAY();
        bytes32 salt1 = bytes32(uint256(13));
        bytes32 salt2 = bytes32(uint256(14));
        vm.warp(START_TIME - delay - 1);

        _commit(spectator1, 0, 1 ether, salt1);
        _commit(spectator2, 1, 2 ether, salt2);

        vm.warp(START_TIME - 1);
        _reveal(spectator1, 0, 1 ether, salt1);
        _reveal(spectator2, 1, 2 ether, salt2);
        
        // Total pool = 3 ether
        // Odds for agent 0 = (3 * 1e18) / 1 = 3e18
        uint256 odds0 = betting.getOdds(BATTLE_ID, 0);
        assertEq(odds0, 3e18);
        
        // Odds for agent 1 = (3 * 1e18) / 2 = 1.5e18
        uint256 odds1 = betting.getOdds(BATTLE_ID, 1);
        assertEq(odds1, 1.5e18);
    }

    function testGetOddsNoBets() public {
        uint256 odds = betting.getOdds(BATTLE_ID, 0);
        assertEq(odds, 0);
    }

    function testMultipleBetsSameAgent() public {
        vm.deal(spectator1, 5 ether);
        uint256 delay = betting.MIN_COMMIT_DELAY();
        bytes32 salt1 = bytes32(uint256(15));
        bytes32 salt2 = bytes32(uint256(16));
        vm.warp(START_TIME - delay - 1);

        _commit(spectator1, 0, 1 ether, salt1);
        _commit(spectator1, 0, 2 ether, salt2);

        vm.warp(START_TIME - 1);
        _reveal(spectator1, 0, 1 ether, salt1);
        _reveal(spectator1, 0, 2 ether, salt2);
        
        (uint256 amount, ) = betting.bets(BATTLE_ID, 0, spectator1);
        assertEq(amount, 3 ether);
        assertEq(betting.totalWageredPerAgent(BATTLE_ID, 0), 3 ether);
    }

    function testRegisterBattleDuplicateAgents() public {
        SpectatorBetting freshBetting = new SpectatorBetting(arena);
        address[] memory agents = new address[](2);
        agents[0] = address(10);
        agents[1] = address(10);

        MockBattle freshBattle = new MockBattle(agents);

        vm.prank(arena);
        vm.expectRevert("Duplicate agent");
        freshBetting.registerBattle(1, address(freshBattle), agents, START_TIME);
    }

    function testPlaceBetFromContractReverts() public {
        BettingCaller caller = new BettingCaller();
        uint256 delay = betting.MIN_COMMIT_DELAY();
        bytes32 salt = bytes32(uint256(17));
        bytes32 commitHash = betting.getCommitHash(
            address(caller),
            BATTLE_ID,
            0,
            1 ether,
            salt
        );
        vm.warp(START_TIME - delay - 1);

        vm.expectRevert("EOA only");
        caller.commitBet(address(betting), BATTLE_ID, commitHash);
    }
}
