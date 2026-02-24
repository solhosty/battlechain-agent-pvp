// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/Battle.sol";
import "../src/challenges/ReentrancyVault.sol";
import "./mocks/MockAgent.sol";

contract BattleTest is Test {
    Battle public battle;
    ReentrancyVault public challenge;
    
    address public arena = address(1);
    address public player1 = address(2);
    address public player2 = address(3);
    address public player3 = address(4);
    
    uint256 public constant ENTRY_FEE = 1 ether;
    uint256 public constant DEADLINE = 1 days;

    function setUp() public {
        challenge = new ReentrancyVault();
        
        vm.prank(arena);
        battle = new Battle(
            address(challenge),
            ENTRY_FEE,
            5,
            block.timestamp + DEADLINE,
            arena
        );
        
        // Fund challenge
        vm.deal(address(challenge), 10 ether);
    }

    function testRegisterAgent() public {
        MockAgent agent = new MockAgent("Agent1", player1, true, 0);
        
        vm.prank(arena);
        battle.registerAgent(address(agent));
        
        address[] memory agents = battle.getAgents();
        assertEq(agents.length, 1);
        assertEq(agents[0], address(agent));
    }

    function testStartBattle() public {
        MockAgent agent1 = new MockAgent("Agent1", player1, true, 0);
        MockAgent agent2 = new MockAgent("Agent2", player2, true, 0);
        
        vm.startPrank(arena);
        battle.registerAgent(address(agent1));
        battle.registerAgent(address(agent2));
        battle.startBattle();
        vm.stopPrank();
        
        assertEq(uint256(battle.getState()), uint256(Battle.BattleState.ACTIVE));
    }

    function testStartBattleNotEnoughAgents() public {
        MockAgent agent1 = new MockAgent("Agent1", player1, true, 0);
        
        vm.prank(arena);
        battle.registerAgent(address(agent1));
        
        vm.prank(arena);
        vm.expectRevert("Need at least 2 agents");
        battle.startBattle();
    }

    function testResolveBattle() public {
        // Setup agents with different extraction amounts
        MockAgent agent1 = new MockAgent("Agent1", player1, true, 1 ether);
        MockAgent agent2 = new MockAgent("Agent2", player2, true, 2 ether);
        
        vm.startPrank(arena);
        battle.registerAgent(address(agent1));
        battle.registerAgent(address(agent2));
        battle.startBattle();
        vm.stopPrank();
        
        // Warp past deadline
        vm.warp(block.timestamp + DEADLINE + 1);
        
        vm.prank(arena);
        battle.resolveBattle();
        
        assertEq(uint256(battle.getState()), uint256(Battle.BattleState.RESOLVED));
        assertEq(battle.getWinner(), address(agent2)); // Agent2 extracted more
        assertEq(battle.winningAmount(), 2 ether);
    }

    function testResolveBattleTooEarly() public {
        MockAgent agent1 = new MockAgent("Agent1", player1, true, 0);
        MockAgent agent2 = new MockAgent("Agent2", player2, true, 0);
        
        vm.startPrank(arena);
        battle.registerAgent(address(agent1));
        battle.registerAgent(address(agent2));
        battle.startBattle();
        vm.stopPrank();
        
        vm.prank(arena);
        vm.expectRevert("Battle still active");
        battle.resolveBattle();
    }

    function testClaimPrize() public {
        // Setup and resolve battle
        MockAgent agent1 = new MockAgent("Agent1", player1, true, 0);
        MockAgent agent2 = new MockAgent("Agent2", player2, true, 1 ether);
        
        vm.startPrank(arena);
        battle.registerAgent(address(agent1));
        battle.registerAgent(address(agent2));
        battle.startBattle();
        vm.stopPrank();
        
        vm.warp(block.timestamp + DEADLINE + 1);
        
        vm.prank(arena);
        battle.resolveBattle();
        
        // Fund battle contract
        vm.deal(address(battle), 10 ether);
        
        uint256 initialBalance = player2.balance;
        
        // Claim prize as winner
        vm.prank(player2);
        battle.claimPrize();
        
        // Winner gets 70%
        assertEq(player2.balance - initialBalance, 7 ether);
        assertEq(uint256(battle.getState()), uint256(Battle.BattleState.CLAIMED));
    }

    function testClaimPrizeNotWinner() public {
        MockAgent agent1 = new MockAgent("Agent1", player1, true, 0);
        MockAgent agent2 = new MockAgent("Agent2", player2, true, 1 ether);
        
        vm.startPrank(arena);
        battle.registerAgent(address(agent1));
        battle.registerAgent(address(agent2));
        battle.startBattle();
        vm.stopPrank();
        
        vm.warp(block.timestamp + DEADLINE + 1);
        
        vm.prank(arena);
        battle.resolveBattle();
        
        vm.prank(player1);
        vm.expectRevert("Not winner");
        battle.claimPrize();
    }

    function testAgentFailureHandling() public {
        // One agent succeeds, one fails
        MockAgent agent1 = new MockAgent("Agent1", player1, false, 0); // Will fail
        MockAgent agent2 = new MockAgent("Agent2", player2, true, 1 ether); // Will succeed
        
        vm.startPrank(arena);
        battle.registerAgent(address(agent1));
        battle.registerAgent(address(agent2));
        battle.startBattle();
        vm.stopPrank();
        
        vm.warp(block.timestamp + DEADLINE + 1);
        
        vm.prank(arena);
        battle.resolveBattle();
        
        // Even though agent1 failed, agent2 should still be winner
        assertEq(battle.getWinner(), address(agent2));
    }
}
