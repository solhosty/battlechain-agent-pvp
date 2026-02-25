// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/Battle.sol";
import "../src/interfaces/IAgent.sol";
import "../src/interfaces/IBattle.sol";
import "./mocks/MockAgent.sol";

contract DrainableChallenge {
    event Drained(address indexed recipient, uint256 amount);

    function drain(address recipient, uint256 amount) external {
        require(address(this).balance >= amount, "Insufficient balance");
        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "Drain failed");
        emit Drained(recipient, amount);
    }

    receive() external payable {}
}

contract DrainAgent is IAgent {
    string public name;
    address public owner;
    bool public shouldSucceed;
    uint256 public extractionAmount;

    constructor(
        string memory _name,
        address _owner,
        bool _shouldSucceed,
        uint256 _extractionAmount
    ) {
        name = _name;
        owner = _owner;
        shouldSucceed = _shouldSucceed;
        extractionAmount = _extractionAmount;
    }

    function attack(address target) external override {
        require(shouldSucceed, "Attack failed");

        if (extractionAmount > 0) {
            DrainableChallenge(payable(target)).drain(
                address(this),
                extractionAmount
            );
        }
    }

    function getName() external view override returns (string memory) {
        return name;
    }

    receive() external payable {}
}

contract BattleTest is Test {
    Battle public battle;
    DrainableChallenge public challenge;
    
    address public arena = address(1);
    address public player1 = address(2);
    address public player2 = address(3);
    address public player3 = address(4);
    
    uint256 public constant ENTRY_FEE = 1 ether;
    uint256 public constant DEADLINE = 1 days;

    function setUp() public {
        challenge = new DrainableChallenge();
        
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
        
        assertEq(uint256(battle.getState()), uint256(IBattle.BattleState.ACTIVE));
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
        DrainAgent agent1 = new DrainAgent("Agent1", player1, true, 1 ether);
        DrainAgent agent2 = new DrainAgent("Agent2", player2, true, 2 ether);
        
        vm.startPrank(arena);
        battle.registerAgent(address(agent1));
        battle.registerAgent(address(agent2));
        battle.startBattle();
        vm.stopPrank();
        
        // Warp past deadline
        vm.warp(block.timestamp + DEADLINE + 1);
        
        vm.prank(arena);
        battle.resolveBattle();
        
        assertEq(uint256(battle.getState()), uint256(IBattle.BattleState.RESOLVED));
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
        DrainAgent agent1 = new DrainAgent("Agent1", player1, true, 0);
        DrainAgent agent2 = new DrainAgent("Agent2", player2, true, 1 ether);

        vm.deal(arena, 10 ether);
        vm.startPrank(arena);
        battle.fundPrizePool{value: 10 ether}();
        battle.registerAgent(address(agent1));
        battle.registerAgent(address(agent2));
        battle.startBattle();
        vm.stopPrank();
        
        vm.warp(block.timestamp + DEADLINE + 1);
        
        vm.prank(arena);
        battle.resolveBattle();
        
        uint256 initialBalance = player2.balance;
        
        // Claim prize as winner
        vm.prank(player2);
        battle.claimPrize();
        
        // Winner gets 70%
        assertEq(player2.balance - initialBalance, 7 ether);
        assertEq(uint256(battle.getState()), uint256(IBattle.BattleState.CLAIMED));
    }

    function testClaimPrizeNotWinner() public {
        DrainAgent agent1 = new DrainAgent("Agent1", player1, true, 0);
        DrainAgent agent2 = new DrainAgent("Agent2", player2, true, 1 ether);
        
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
        DrainAgent agent1 = new DrainAgent("Agent1", player1, false, 1 ether); // Will fail
        DrainAgent agent2 = new DrainAgent("Agent2", player2, true, 1 ether); // Will succeed
        
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
