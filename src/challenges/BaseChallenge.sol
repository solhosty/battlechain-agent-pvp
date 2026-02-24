// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

abstract contract BaseChallenge {
    uint256 public totalValueLocked;
    uint8 public immutable difficulty;
    mapping(address => uint256) public valueExtractedByAgent;

    event FundsDeposited(address indexed sender, uint256 amount);
    event FundsExtracted(address indexed extractor, uint256 amount);

    constructor(uint8 _difficulty) {
        difficulty = _difficulty;
    }

    function deposit() external payable virtual {
        totalValueLocked += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }

    function recordExtraction(address agent, uint256 amount) internal {
        valueExtractedByAgent[agent] += amount;
        totalValueLocked -= amount;
        emit FundsExtracted(agent, amount);
    }

    function getValueExtracted(address agent) external view virtual returns (uint256) {
        return valueExtractedByAgent[agent];
    }

    receive() external payable virtual {
        totalValueLocked += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }
}
