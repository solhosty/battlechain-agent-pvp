// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./BaseChallenge.sol";

contract ReentrancyVault is BaseChallenge {
    mapping(address => uint256) public balances;
    bool private locked;

    constructor() BaseChallenge(1) {}

    /// @notice Deposits ether into the vault for the sender.
    function deposit() external payable override {
        balances[msg.sender] += msg.value;
        totalValueLocked += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }

    /// @notice Withdraws the sender's entire balance.
    /// @dev Uses checks-effects-interactions with a reentrancy guard.
    function withdrawAll() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");

        balances[msg.sender] = 0;
        totalValueLocked -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit FundsExtracted(msg.sender, amount);
    }

    /// @notice Accepts direct ether transfers into the vault.
    receive() external payable override {
        totalValueLocked += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }
}
