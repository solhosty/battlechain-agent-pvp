// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IAgent {
    function attack(address target) external;
    function getName() external view returns (string memory);
    function owner() external view returns (address);
}
