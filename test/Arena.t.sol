// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/Arena.sol";
import "../src/Battle.sol";
import "../src/interfaces/IBattle.sol";
import "../src/ChallengeFactory.sol";
import "../src/interfaces/IChallengeFactory.sol";
import "./mocks/MockAgent.sol";
import "./mocks/MockAttackRegistry.sol";

contract ArenaTest is Test {
    Arena public arena;
    MockAttackRegistry public attackRegistry;
    ChallengeFactory public challengeFactory;
    
    address public owner = address(1);
    address public player1 = address(2);
    address public player2 = address(3);
    
    uint256 public constant ENTRY_FEE = 1 ether;
    uint256 public constant BATTLE_DURATION = 1 days;

    function setUp() public {
        vm.startPrank(owner);
        
        attackRegistry = new MockAttackRegistry();
        challengeFactory = new ChallengeFactory();
        
        challengeFactory.setChallengeTypeEnabled(
            IChallengeFactory.ChallengeType.REENTRANCY_VAULT,
            true
        );
        
        arena = new Arena(
            address(attackRegistry),
            address(0), // safeHarbor not used in tests
            address(challengeFactory)
        );

        challengeFactory.setAuthorizedCaller(address(arena), true);
        
        vm.stopPrank();
    }

    function testCreateBattle() public {
        vm.deal(player1, 2 ether);
        vm.prank(player1);
        
        uint256 battleId = arena.createBattle{value: ENTRY_FEE}(
            IChallengeFactory.ChallengeType.REENTRANCY_VAULT,
            ENTRY_FEE,
            5,
            BATTLE_DURATION
        );
        
        assertEq(battleId, 0);
        assertTrue(arena.battles(0) != address(0));
        assertEq(arena.battles(0).balance, ENTRY_FEE);
    }

    function testCreateBattleInsufficientFee() public {
        vm.deal(player1, 0.5 ether);
        vm.prank(player1);
        
        vm.expectRevert("Insufficient entry fee");
        arena.createBattle{value: 0.5 ether}(
            IChallengeFactory.ChallengeType.REENTRANCY_VAULT,
            ENTRY_FEE,
            5,
            BATTLE_DURATION
        );
    }

    function testCreateBattleInvalidAgentCount() public {
        vm.deal(player1, 2 ether);
        vm.prank(player1);
        
        vm.expectRevert("Invalid agent count");
        arena.createBattle{value: ENTRY_FEE}(
            IChallengeFactory.ChallengeType.REENTRANCY_VAULT,
            ENTRY_FEE,
            1, // Too few agents
            BATTLE_DURATION
        );
    }

    function testRegisterAgent() public {
        // Create battle
        vm.deal(player1, 2 ether);
        vm.prank(player1);
        uint256 battleId = arena.createBattle{value: ENTRY_FEE}(
            IChallengeFactory.ChallengeType.REENTRANCY_VAULT,
            ENTRY_FEE,
            5,
            BATTLE_DURATION
        );
        
        // Create and register agent
        MockAgent agent = new MockAgent("Agent1", player1, true, 0);
        
        vm.prank(player1);
        arena.registerAgent(battleId, address(agent));
        
        Battle battle = Battle(payable(arena.getBattle(battleId)));
        address[] memory agents = battle.getAgents();
        assertEq(agents.length, 1);
        assertEq(agents[0], address(agent));
    }

    function testRegisterAgentUnauthorizedCaller() public {
        vm.deal(player1, 2 ether);
        vm.prank(player1);
        uint256 battleId = arena.createBattle{value: ENTRY_FEE}(
            IChallengeFactory.ChallengeType.REENTRANCY_VAULT,
            ENTRY_FEE,
            5,
            BATTLE_DURATION
        );

        MockAgent agent = new MockAgent("Agent1", player1, true, 0);

        vm.prank(player2);
        vm.expectRevert("Not agent owner");
        arena.registerAgent(battleId, address(agent));
    }

    function testStartBattle() public {
        // Create battle
        vm.deal(player1, 2 ether);
        vm.prank(player1);
        uint256 battleId = arena.createBattle{value: ENTRY_FEE}(
            IChallengeFactory.ChallengeType.REENTRANCY_VAULT,
            ENTRY_FEE,
            5,
            BATTLE_DURATION
        );
        
        // Register two agents
        MockAgent agent1 = new MockAgent("Agent1", player1, true, 0);
        MockAgent agent2 = new MockAgent("Agent2", player2, true, 0);
        
        vm.prank(player1);
        arena.registerAgent(battleId, address(agent1));
        
        vm.prank(player2);
        arena.registerAgent(battleId, address(agent2));
        
        // Start battle
        vm.prank(player1);
        arena.startBattle(battleId);
        
        Battle battle = Battle(payable(arena.getBattle(battleId)));
        assertEq(uint256(battle.getState()), uint256(IBattle.BattleState.ACTIVE));
    }

    function testPause() public {
        vm.prank(owner);
        arena.setPaused(true);
        
        assertTrue(arena.paused());
        
        vm.deal(player1, 2 ether);
        vm.prank(player1);
        vm.expectRevert("Contract paused");
        arena.createBattle{value: ENTRY_FEE}(
            IChallengeFactory.ChallengeType.REENTRANCY_VAULT,
            ENTRY_FEE,
            5,
            BATTLE_DURATION
        );
    }

    function testGetCreatorBattles() public {
        vm.deal(player1, 5 ether);
        vm.startPrank(player1);
        
        arena.createBattle{value: ENTRY_FEE}(
            IChallengeFactory.ChallengeType.REENTRANCY_VAULT,
            ENTRY_FEE,
            5,
            BATTLE_DURATION
        );
        
        arena.createBattle{value: ENTRY_FEE}(
            IChallengeFactory.ChallengeType.REENTRANCY_VAULT,
            ENTRY_FEE,
            5,
            BATTLE_DURATION
        );
        
        vm.stopPrank();

        uint256 count = arena.getCreatorBattleCount(player1);
        assertEq(count, 2);

        uint256[] memory battles = arena.getCreatorBattles(player1, 0, 10);
        assertEq(battles.length, 2);
        assertEq(battles[0], 0);
        assertEq(battles[1], 1);

        uint256 first = arena.getCreatorBattleAt(player1, 0);
        assertEq(first, 0);
    }

    function testChallengeFactoryDeployUnauthorizedCaller() public {
        vm.expectRevert("Not authorized");
        challengeFactory.deployChallenge(IChallengeFactory.ChallengeType.REENTRANCY_VAULT);
    }
}
