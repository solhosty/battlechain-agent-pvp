// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../src/interfaces/IAgent.sol";

contract MockAgent is IAgent {
    string public name;
    address private agentOwner;
    bool public shouldSucceed;
    uint256 public extractionAmount;
    bool public shouldRevertOwner;
    uint256 public increaseBalanceAmount;

    constructor(string memory _name, address _owner, bool _shouldSucceed, uint256 _extractionAmount) {
        name = _name;
        agentOwner = _owner;
        shouldSucceed = _shouldSucceed;
        extractionAmount = _extractionAmount;
    }

    function owner() external view override returns (address) {
        require(!shouldRevertOwner, "Owner query failed");
        return agentOwner;
    }

    function attack(address target) external override {
        require(shouldSucceed, "Attack failed");

        if (increaseBalanceAmount > 0) {
            (bool success, ) = payable(target).call{value: increaseBalanceAmount}("");
            require(success, "Increase failed");
        }
        
        // Try to extract funds from target
        if (extractionAmount > 0 && target.balance >= extractionAmount) {
            (bool success, ) = payable(address(this)).call{value: extractionAmount}("");
            require(success, "Extraction failed");
        }
    }

    function getName() external view override returns (string memory) {
        return name;
    }

    function setOwner(address newOwner) external {
        agentOwner = newOwner;
    }

    function setOwnerRevert(bool shouldRevert) external {
        shouldRevertOwner = shouldRevert;
    }

    function setIncreaseBalanceAmount(uint256 amount) external {
        increaseBalanceAmount = amount;
    }

    receive() external payable {}
}
