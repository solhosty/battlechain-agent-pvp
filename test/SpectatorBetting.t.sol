// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/SpectatorBetting.sol";

contract SpectatorBettingTest is Test {
    SpectatorBetting public betting;
    
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
        
        vm.prank(arena);
        betting.registerBattle(BATTLE_ID, agents, START_TIME);
    }

    function testPlaceBet() public {
        vm.deal(spectator1, 2 ether);
        vm.warp(START_TIME - 1);
        
        vm.prank(spectator1);
        betting.placeBet{value: 1 ether}(BATTLE_ID, 0);
        
        (uint256 amount, bool claimed) = betting.bets(BATTLE_ID, 0, spectator1);
        assertEq(amount, 1 ether);
        assertFalse(claimed);
        assertEq(betting.totalWageredPerAgent(BATTLE_ID, 0), 1 ether);
        assertEq(betting.totalPool(BATTLE_ID), 1 ether);
    }

    function testPlaceBetBattleStarted() public {
        vm.deal(spectator1, 2 ether);
        vm.warp(START_TIME + 1);
        
        vm.prank(spectator1);
        vm.expectRevert("Battle started");
        betting.placeBet{value: 1 ether}(BATTLE_ID, 0);
    }

    function testPlaceBetInvalidAgent() public {
        vm.deal(spectator1, 2 ether);
        vm.warp(START_TIME - 1);
        
        vm.prank(spectator1);
        vm.expectRevert(); // Invalid agent index
        betting.placeBet{value: 1 ether}(BATTLE_ID, 10);
    }

    function testCalculatePayout() public {
        vm.deal(spectator1, 3 ether);
        vm.deal(spectator2, 3 ether);
        vm.deal(spectator3, 3 ether);
        vm.warp(START_TIME - 1);
        
        // Place bets: 1 ether on agent 0, 2 ether on agent 1
        vm.prank(spectator1);
        betting.placeBet{value: 1 ether}(BATTLE_ID, 0);
        
        vm.prank(spectator2);
        betting.placeBet{value: 2 ether}(BATTLE_ID, 1);
        
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
        vm.warp(START_TIME - 1);
        
        // Place bets
        vm.prank(spectator1);
        betting.placeBet{value: 1 ether}(BATTLE_ID, 0);
        
        vm.prank(spectator2);
        betting.placeBet{value: 2 ether}(BATTLE_ID, 1);
        
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
        vm.warp(START_TIME - 1);
        
        vm.prank(spectator1);
        betting.placeBet{value: 1 ether}(BATTLE_ID, 0);
        
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
        vm.warp(START_TIME - 1);
        
        vm.prank(spectator1);
        betting.placeBet{value: 1 ether}(BATTLE_ID, 0);
        
        vm.prank(arena);
        betting.resolveBets(BATTLE_ID, 0);
        
        vm.deal(address(betting), 2 ether);
        
        vm.startPrank(spectator1);
        betting.claimPayout(BATTLE_ID);
        
        vm.expectRevert("Already claimed");
        betting.claimPayout(BATTLE_ID);
        vm.stopPrank();
    }

    function testGetOdds() public {
        vm.deal(spectator1, 3 ether);
        vm.deal(spectator2, 3 ether);
        vm.warp(START_TIME - 1);
        
        vm.prank(spectator1);
        betting.placeBet{value: 1 ether}(BATTLE_ID, 0);
        
        vm.prank(spectator2);
        betting.placeBet{value: 2 ether}(BATTLE_ID, 1);
        
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
        vm.warp(START_TIME - 1);
        
        vm.startPrank(spectator1);
        betting.placeBet{value: 1 ether}(BATTLE_ID, 0);
        betting.placeBet{value: 2 ether}(BATTLE_ID, 0);
        vm.stopPrank();
        
        (uint256 amount, ) = betting.bets(BATTLE_ID, 0, spectator1);
        assertEq(amount, 3 ether);
        assertEq(betting.totalWageredPerAgent(BATTLE_ID, 0), 3 ether);
    }

    function testRegisterBattleDuplicateAgents() public {
        SpectatorBetting freshBetting = new SpectatorBetting(arena);
        address[] memory agents = new address[](2);
        agents[0] = address(10);
        agents[1] = address(10);

        vm.prank(arena);
        vm.expectRevert("Duplicate agent");
        freshBetting.registerBattle(1, agents, START_TIME);
    }
}
