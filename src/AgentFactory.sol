// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Arena.sol";

contract AgentFactory {
    address public immutable arena;
    mapping(address => address[]) private agentsByOwner;
    mapping(address => address) private agentOwner;

    event AgentCreated(address indexed agent, address indexed owner);

    /// @notice Sets the arena that receives agent registrations.
    constructor(address arenaAddress) {
        arena = arenaAddress;
    }

    /// @notice Deploys an agent from creation bytecode and records ownership.
    function createAgent(bytes memory bytecode) external returns (address agent) {
        require(bytecode.length > 0, "Empty bytecode");
        assembly {
            agent := create(0, add(bytecode, 0x20), mload(bytecode))
        }
        require(agent != address(0), "Deploy failed");
        agentOwner[agent] = msg.sender;
        agentsByOwner[msg.sender].push(agent);
        emit AgentCreated(agent, msg.sender);
    }

    /// @notice Returns agents deployed by the given owner.
    function getAgentsByOwner(address owner) external view returns (address[] memory) {
        return agentsByOwner[owner];
    }

    /// @notice Returns the recorded owner for an agent.
    function getAgentOwner(address agent) external view returns (address) {
        return agentOwner[agent];
    }

    /// @notice Registers an agent for a battle through the arena.
    function registerAgent(uint256 battleId, address agent) external {
        require(agentOwner[agent] == msg.sender, "Not agent owner");
        Arena(arena).registerAgent(battleId, agent);
    }
}
