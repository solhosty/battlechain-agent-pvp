// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../src/interfaces/IAgent.sol";

contract MockAgent is IAgent {
    string public name;
    address public owner;
    bool public shouldSucceed;
    uint256 public extractionAmount;

    constructor(string memory _name, address _owner, bool _shouldSucceed, uint256 _extractionAmount) {
        name = _name;
        owner = _owner;
        shouldSucceed = _shouldSucceed;
        extractionAmount = _extractionAmount;
    }

    function attack(address target) external override {
        require(shouldSucceed, "Attack failed");
        
        // Try to extract funds from target
        if (extractionAmount > 0 && target.balance >= extractionAmount) {
            (bool success, ) = payable(address(this)).call{value: extractionAmount}("");
            require(success, "Extraction failed");
        }
    }

    function getName() external view override returns (string memory) {
        return name;
    }

    receive() external payable {}
}
