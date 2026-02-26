// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice Interface for deploying agent instances.
interface IAgentFactory {
    /// @notice Deploys an agent from creation bytecode.
    function createAgent(
        string memory name,
        bytes memory bytecode
    ) external returns (address agent);

    /// @notice Returns agents deployed by the given owner.
    function getAgentsByOwner(address owner) external view returns (address[] memory);

    /// @notice Returns the total number of agents deployed.
    function getAgentCount() external view returns (uint256);
}
