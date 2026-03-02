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
    function commitBet(address bettingAddress, uint256 battleId, bytes32 commitment) external {
        SpectatorBetting(bettingAddress).commitBet(battleId, commitment);
    }

    function revealBet(
        address bettingAddress,
        uint256 battleId,
        uint256 agentIndex,
        uint256 amount,
        bytes32 salt
    ) external payable {
        SpectatorBetting(bettingAddress).revealBet{value: msg.value}(
            battleId,
            agentIndex,
            amount,
            salt
        );
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

    function _commitment(
        uint256 battleId,
        uint256 agentIndex,
        uint256 amount,
        bytes32 salt,
        address bettor
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(battleId, agentIndex, amount, salt, bettor));
    }

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

    function testCommitRevealBet() public {
        vm.deal(spectator1, 2 ether);

        bytes32 salt = keccak256("salt");
        bytes32 commitment = _commitment(BATTLE_ID, 0, 1 ether, salt, spectator1);

        vm.warp(START_TIME - 120);
        vm.prank(spectator1);
        betting.commitBet(BATTLE_ID, commitment);

        vm.warp(START_TIME - 1);
        vm.prank(spectator1);
        betting.revealBet{value: 1 ether}(BATTLE_ID, 0, 1 ether, salt);
        
        (uint256 amount, bool claimed) = betting.bets(BATTLE_ID, 0, spectator1);
        assertEq(amount, 1 ether);
        assertFalse(claimed);
        assertEq(betting.totalWageredPerAgent(BATTLE_ID, 0), 1 ether);
        assertEq(betting.totalPool(BATTLE_ID), 1 ether);
    }

    function testRevealBetBattleStarted() public {
        vm.deal(spectator1, 2 ether);
        bytes32 salt = keccak256("salt");
        bytes32 commitment = _commitment(BATTLE_ID, 0, 1 ether, salt, spectator1);

        vm.warp(START_TIME - 120);
        vm.prank(spectator1);
        betting.commitBet(BATTLE_ID, commitment);

        vm.warp(START_TIME + 1);
        vm.prank(spectator1);
        vm.expectRevert("Battle started");
        betting.revealBet{value: 1 ether}(BATTLE_ID, 0, 1 ether, salt);
    }

    function testRevealBetInvalidAgent() public {
        vm.deal(spectator1, 2 ether);
        bytes32 salt = keccak256("salt");
        bytes32 commitment = _commitment(BATTLE_ID, 10, 1 ether, salt, spectator1);

        vm.warp(START_TIME - 120);
        vm.prank(spectator1);
        betting.commitBet(BATTLE_ID, commitment);

        vm.warp(START_TIME - 1);
        vm.prank(spectator1);
        vm.expectRevert("Invalid agent index");
        betting.revealBet{value: 1 ether}(BATTLE_ID, 10, 1 ether, salt);
    }

    function testCalculatePayout() public {
        vm.deal(spectator1, 3 ether);
        vm.deal(spectator2, 3 ether);
        vm.deal(spectator3, 3 ether);

        bytes32 salt1 = keccak256("salt1");
        bytes32 salt2 = keccak256("salt2");
        bytes32 commitment1 = _commitment(BATTLE_ID, 0, 1 ether, salt1, spectator1);
        bytes32 commitment2 = _commitment(BATTLE_ID, 1, 2 ether, salt2, spectator2);

        vm.warp(START_TIME - 120);
        vm.prank(spectator1);
        betting.commitBet(BATTLE_ID, commitment1);
        vm.prank(spectator2);
        betting.commitBet(BATTLE_ID, commitment2);

        vm.warp(START_TIME - 1);
        vm.prank(spectator1);
        betting.revealBet{value: 1 ether}(BATTLE_ID, 0, 1 ether, salt1);
        vm.prank(spectator2);
        betting.revealBet{value: 2 ether}(BATTLE_ID, 1, 2 ether, salt2);
        
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

        bytes32 salt1 = keccak256("salt1");
        bytes32 salt2 = keccak256("salt2");
        bytes32 commitment1 = _commitment(BATTLE_ID, 0, 1 ether, salt1, spectator1);
        bytes32 commitment2 = _commitment(BATTLE_ID, 1, 2 ether, salt2, spectator2);

        vm.warp(START_TIME - 120);
        vm.prank(spectator1);
        betting.commitBet(BATTLE_ID, commitment1);
        vm.prank(spectator2);
        betting.commitBet(BATTLE_ID, commitment2);

        vm.warp(START_TIME - 1);
        vm.prank(spectator1);
        betting.revealBet{value: 1 ether}(BATTLE_ID, 0, 1 ether, salt1);
        vm.prank(spectator2);
        betting.revealBet{value: 2 ether}(BATTLE_ID, 1, 2 ether, salt2);
        
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

        bytes32 salt = keccak256("salt");
        bytes32 commitment = _commitment(BATTLE_ID, 0, 1 ether, salt, spectator1);

        vm.warp(START_TIME - 120);
        vm.prank(spectator1);
        betting.commitBet(BATTLE_ID, commitment);

        vm.warp(START_TIME - 1);
        vm.prank(spectator1);
        betting.revealBet{value: 1 ether}(BATTLE_ID, 0, 1 ether, salt);
        
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

        bytes32 salt = keccak256("salt");
        bytes32 commitment = _commitment(BATTLE_ID, 0, 1 ether, salt, spectator1);

        vm.warp(START_TIME - 120);
        vm.prank(spectator1);
        betting.commitBet(BATTLE_ID, commitment);

        vm.warp(START_TIME - 1);
        vm.prank(spectator1);
        betting.revealBet{value: 1 ether}(BATTLE_ID, 0, 1 ether, salt);
        
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

        bytes32 salt1 = keccak256("salt1");
        bytes32 salt2 = keccak256("salt2");
        bytes32 salt3 = keccak256("salt3");
        bytes32 commitment1 = _commitment(BATTLE_ID, 0, 1 ether, salt1, spectator1);
        bytes32 commitment2 = _commitment(BATTLE_ID, 0, 1 ether, salt2, spectator2);
        bytes32 commitment3 = _commitment(BATTLE_ID, 1, 1 ether, salt3, spectator3);

        vm.warp(START_TIME - 120);
        vm.prank(spectator1);
        betting.commitBet(BATTLE_ID, commitment1);
        vm.prank(spectator2);
        betting.commitBet(BATTLE_ID, commitment2);
        vm.prank(spectator3);
        betting.commitBet(BATTLE_ID, commitment3);

        vm.warp(START_TIME - 1);
        vm.prank(spectator1);
        betting.revealBet{value: 1 ether}(BATTLE_ID, 0, 1 ether, salt1);
        vm.prank(spectator2);
        betting.revealBet{value: 1 ether}(BATTLE_ID, 0, 1 ether, salt2);
        vm.prank(spectator3);
        betting.revealBet{value: 1 ether}(BATTLE_ID, 1, 1 ether, salt3);

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

        bytes32 salt1 = keccak256("salt1");
        bytes32 salt2 = keccak256("salt2");
        bytes32 commitment1 = _commitment(BATTLE_ID, 0, 1 ether, salt1, spectator1);
        bytes32 commitment2 = _commitment(BATTLE_ID, 1, 2 ether, salt2, spectator2);

        vm.warp(START_TIME - 120);
        vm.prank(spectator1);
        betting.commitBet(BATTLE_ID, commitment1);
        vm.prank(spectator2);
        betting.commitBet(BATTLE_ID, commitment2);

        vm.warp(START_TIME - 1);
        vm.prank(spectator1);
        betting.revealBet{value: 1 ether}(BATTLE_ID, 0, 1 ether, salt1);
        vm.prank(spectator2);
        betting.revealBet{value: 2 ether}(BATTLE_ID, 1, 2 ether, salt2);
        
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

        bytes32 salt1 = keccak256("salt1");
        bytes32 salt2 = keccak256("salt2");
        bytes32 commitment1 = _commitment(BATTLE_ID, 0, 1 ether, salt1, spectator1);
        bytes32 commitment2 = _commitment(BATTLE_ID, 0, 2 ether, salt2, spectator1);

        vm.startPrank(spectator1);
        vm.warp(START_TIME - 200);
        betting.commitBet(BATTLE_ID, commitment1);
        vm.warp(START_TIME - 120);
        betting.revealBet{value: 1 ether}(BATTLE_ID, 0, 1 ether, salt1);

        betting.commitBet(BATTLE_ID, commitment2);
        vm.warp(START_TIME - 1);
        betting.revealBet{value: 2 ether}(BATTLE_ID, 0, 2 ether, salt2);
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

        MockBattle freshBattle = new MockBattle(agents);

        vm.prank(arena);
        vm.expectRevert("Duplicate agent");
        freshBetting.registerBattle(1, address(freshBattle), agents, START_TIME);
    }

    function testPlaceBetFromContractReverts() public {
        BettingCaller caller = new BettingCaller();
        vm.deal(address(caller), 1 ether);
        vm.warp(START_TIME - 120);

        bytes32 salt = keccak256("salt");
        bytes32 commitment = _commitment(BATTLE_ID, 0, 1 ether, salt, address(caller));

        vm.prank(address(caller));
        vm.expectRevert("EOA only");
        caller.commitBet(address(betting), BATTLE_ID, commitment);
    }

    function testRevealBetCommitTooRecent() public {
        vm.deal(spectator1, 2 ether);

        bytes32 salt = keccak256("salt");
        bytes32 commitment = _commitment(BATTLE_ID, 0, 1 ether, salt, spectator1);

        vm.warp(START_TIME - 30);
        vm.prank(spectator1);
        betting.commitBet(BATTLE_ID, commitment);

        vm.prank(spectator1);
        vm.expectRevert("Commit too recent");
        betting.revealBet{value: 1 ether}(BATTLE_ID, 0, 1 ether, salt);
    }

    function testRevealBetMismatchCommitment() public {
        vm.deal(spectator1, 2 ether);

        bytes32 salt = keccak256("salt");
        bytes32 commitment = _commitment(BATTLE_ID, 0, 1 ether, salt, spectator1);

        vm.warp(START_TIME - 120);
        vm.prank(spectator1);
        betting.commitBet(BATTLE_ID, commitment);

        vm.warp(START_TIME - 1);
        vm.prank(spectator1);
        vm.expectRevert("Invalid reveal");
        betting.revealBet{value: 1 ether}(BATTLE_ID, 1, 1 ether, salt);
    }
}
