// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/AgentFactory.sol";
import "../src/Arena.sol";
import "../src/Battle.sol";
import "../src/ChallengeFactory.sol";
import "../src/interfaces/IChallengeFactory.sol";
import "./mocks/MockAttackRegistry.sol";
import "./mocks/MockAgent.sol";

contract AgentFactoryTest is Test {
    AgentFactory public agentFactory;
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
            address(0),
            address(challengeFactory)
        );
        challengeFactory.setAuthorizedCaller(address(arena), true);

        agentFactory = new AgentFactory(address(arena));

        vm.stopPrank();
    }

    function testCreateAgentRecordsOwner() public {
        bytes memory bytecode = abi.encodePacked(
            type(MockAgent).creationCode,
            abi.encode("Agent1", player1, true, 0)
        );

        vm.prank(player1);
        address agent = agentFactory.createAgent(bytecode);

        assertEq(agentFactory.getAgentOwner(agent), player1);

        address[] memory agents = agentFactory.getAgentsByOwner(player1);
        assertEq(agents.length, 1);
        assertEq(agents[0], agent);
    }

    function testRegisterAgentByOwner() public {
        vm.deal(player1, 2 ether);
        vm.prank(player1);
        uint256 battleId = arena.createBattle{value: ENTRY_FEE}(
            IChallengeFactory.ChallengeType.REENTRANCY_VAULT,
            ENTRY_FEE,
            5,
            BATTLE_DURATION
        );

        bytes memory bytecode = abi.encodePacked(
            type(MockAgent).creationCode,
            abi.encode("Agent1", player1, true, 0)
        );

        vm.prank(player1);
        address agent = agentFactory.createAgent(bytecode);

        vm.prank(player1);
        agentFactory.registerAgent(battleId, agent);

        Battle battle = Battle(payable(arena.getBattle(battleId)));
        address[] memory agents = battle.getAgents();
        assertEq(agents.length, 1);
        assertEq(agents[0], agent);
    }

    function testRegisterAgentUnauthorized() public {
        vm.deal(player1, 2 ether);
        vm.prank(player1);
        uint256 battleId = arena.createBattle{value: ENTRY_FEE}(
            IChallengeFactory.ChallengeType.REENTRANCY_VAULT,
            ENTRY_FEE,
            5,
            BATTLE_DURATION
        );

        bytes memory bytecode = abi.encodePacked(
            type(MockAgent).creationCode,
            abi.encode("Agent1", player1, true, 0)
        );

        vm.prank(player1);
        address agent = agentFactory.createAgent(bytecode);

        vm.prank(player2);
        vm.expectRevert("Not agent owner");
        agentFactory.registerAgent(battleId, agent);
    }
}
