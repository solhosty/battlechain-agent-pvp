// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./challenges/ReentrancyVault.sol";
import "./interfaces/IChallengeFactory.sol";

contract ChallengeFactory is IChallengeFactory {
    address public owner;
    mapping(ChallengeType => bool) public enabledChallengeTypes;
    mapping(address => bool) public authorizedCallers;

    event ChallengeTypeStatusUpdated(ChallengeType indexed challengeType, bool enabled);
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    event ChallengeDeployed(
        ChallengeType indexed challengeType,
        address indexed instance,
        address indexed caller
    );
    event OwnerUpdated(address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAuthorizedCaller() {
        require(authorizedCallers[msg.sender], "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Enables or disables a challenge type.
    function setChallengeTypeEnabled(
        ChallengeType challengeType,
        bool enabled
    ) external onlyOwner {
        enabledChallengeTypes[challengeType] = enabled;
        emit ChallengeTypeStatusUpdated(challengeType, enabled);
    }

    /// @notice Authorizes or revokes a caller for deployments.
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    /// @notice Deploys a challenge instance for the given type.
    function deployChallenge(
        ChallengeType challengeType
    ) external onlyAuthorizedCaller returns (address) {
        require(enabledChallengeTypes[challengeType], "Challenge not authorized");

        address instance;

        if (challengeType == ChallengeType.REENTRANCY_VAULT) {
            instance = address(new ReentrancyVault());
        } else {
            revert("Unknown challenge type");
        }

        emit ChallengeDeployed(challengeType, instance, msg.sender);
        return instance;
    }

    /// @notice Transfers contract ownership.
    function setOwner(address newOwner) external onlyOwner {
        owner = newOwner;
        emit OwnerUpdated(newOwner);
    }
}
