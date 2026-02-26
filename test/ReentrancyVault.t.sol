// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/challenges/ReentrancyVault.sol";

contract ReentrancyAttacker {
    ReentrancyVault public vault;
    uint256 public attackCount;
    uint256 public constant MAX_ATTACKS = 5;

    constructor(address payable _vault) {
        vault = ReentrancyVault(payable(_vault));
    }

    function attack() external payable {
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
        assertEq(vault.totalValueLocked(), 5 ether);
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
        ReentrancyAttacker exploiter = new ReentrancyAttacker(payable(address(vault)));
        
        uint256 vaultBalanceBefore = address(vault).balance;
        uint256 attackerBalanceBefore = address(exploiter).balance;

        // Execute reentrancy attack, which should revert
        vm.prank(attacker);
        vm.expectRevert("Transfer failed");
        exploiter.attack{value: 1 ether}();

        uint256 vaultBalanceAfter = address(vault).balance;
        uint256 attackerBalanceAfter = address(exploiter).balance;

        // Vault and attacker balances should remain unchanged
        assertEq(attackerBalanceAfter, attackerBalanceBefore);
        assertEq(vaultBalanceAfter, vaultBalanceBefore);
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
        vm.prank(victim);
        vault.deposit{value: 5 ether}();

        vm.prank(victim);
        vault.withdrawAll();

        assertEq(vault.getValueExtracted(victim), 5 ether);
    }
}
