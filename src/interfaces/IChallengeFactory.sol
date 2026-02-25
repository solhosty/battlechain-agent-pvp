// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice Interface for deploying challenge instances.
interface IChallengeFactory {
    /// @notice Supported challenge types.
    enum ChallengeType {
        REENTRANCY_VAULT
    }

    /// @notice Deploys a challenge instance for the given type.
    function deployChallenge(ChallengeType challengeType) external returns (address);

    /// @notice Enables or disables a challenge type.
    function setChallengeTypeEnabled(ChallengeType challengeType, bool enabled) external;

    /// @notice Authorizes or revokes a caller for deployments.
    function setAuthorizedCaller(address caller, bool authorized) external;

    /// @notice Returns whether a challenge type is enabled.
    function enabledChallengeTypes(ChallengeType challengeType) external view returns (bool);

    /// @notice Returns whether a caller is authorized.
    function authorizedCallers(address caller) external view returns (bool);
}
