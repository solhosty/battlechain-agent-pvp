export const buildAgentTemplate = (prompt: string) => `// SPDX-License-Identifier: MIT
// Prompt: ${prompt}
pragma solidity ^0.8.19;

interface IAgent { function attack(address) external; function getName() external view returns (string memory); function owner() external view returns (address); }

contract GeneratedAgent is IAgent {
  address public immutable owner;
  constructor() { owner = msg.sender; }
  function attack(address) external override {}
  function getName() external pure returns (string memory) { return "GeneratedAgent"; }
}
`;
