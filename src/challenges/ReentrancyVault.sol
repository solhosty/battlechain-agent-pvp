// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./BaseChallenge.sol";

contract ReentrancyVault is BaseChallenge {
    mapping(address => uint256) public balances;

    constructor() BaseChallenge(1) {}

    function deposit() external payable override {
        balances[msg.sender] += msg.value;
        totalValueLocked += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }

    function withdrawAll() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");

        // VULNERABLE: External call before state update
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        // State update happens after external call
        balances[msg.sender] = 0;
        totalValueLocked -= amount;
        
        emit FundsExtracted(msg.sender, amount);
    }

    receive() external payable override {
        totalValueLocked += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }
}
