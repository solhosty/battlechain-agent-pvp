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
        _withdrawTo(msg.sender, msg.sender);
    }

    /// @notice Withdraws the sender's entire balance to a recipient.
    function withdrawTo(address recipient) external nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        _withdrawTo(msg.sender, recipient);
    }

    /// @notice Accepts direct ether transfers into the vault.
    receive() external payable override {
        balances[msg.sender] += msg.value;
        totalValueLocked += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }

    function _withdrawTo(address account, address recipient) internal {
        uint256 amount = balances[account];
        require(amount > 0, "No balance");

        balances[account] = 0;
        recordExtraction(account, amount);

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");
    }

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }
}
