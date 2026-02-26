// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IAgentFactory.sol";

contract AgentFactory is IAgentFactory {
    address public owner;

    uint256 public nextAgentId;
    uint256[] public agentIds;
    mapping(address => address[]) public agentsByOwner;
    mapping(uint256 => address) public agentById;

    event AgentCreated(
        uint256 indexed agentId,
        address indexed agent,
        address indexed owner,
        string name
    );
    event OwnerUpdated(address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        nextAgentId = 1;
    }

    /// @notice Transfers contract ownership.
    function setOwner(address newOwner) external onlyOwner {
        owner = newOwner;
        emit OwnerUpdated(newOwner);
    }

    /// @notice Deploys an agent from creation bytecode.
    function createAgent(
        string memory name,
        bytes memory bytecode
    ) external returns (address agent) {
        require(bytecode.length != 0, "Empty bytecode");
        uint256 agentId = nextAgentId;
        bytes32 salt = keccak256(abi.encode(msg.sender, name, agentId));

        assembly {
            agent := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }

        require(agent != address(0), "Create2 failed");

        nextAgentId = agentId + 1;
        agentIds.push(agentId);
        agentById[agentId] = agent;
        agentsByOwner[msg.sender].push(agent);

        emit AgentCreated(agentId, agent, msg.sender, name);
    }

    /// @notice Returns agents deployed by the given owner.
    function getAgentsByOwner(address ownerAddress) external view returns (address[] memory) {
        return agentsByOwner[ownerAddress];
    }

    /// @notice Returns the total number of agents deployed.
    function getAgentCount() external view returns (uint256) {
        return agentIds.length;
    }
}
