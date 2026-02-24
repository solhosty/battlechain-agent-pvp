// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./challenges/ReentrancyVault.sol";

contract ChallengeFactory {
    address public owner;
    mapping(address => bool) public authorizedChallenges;
    
    event ChallengeDeployed(address indexed challengeType, address indexed instance);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function authorizeChallenge(address challengeType) external onlyOwner {
        authorizedChallenges[challengeType] = true;
    }

    function deployChallenge(address challengeType) external returns (address) {
        require(authorizedChallenges[challengeType], "Challenge not authorized");
        
        address instance;
        
        // Deploy based on challenge type
        if (challengeType == address(1)) {
            // ReentrancyVault
            instance = address(new ReentrancyVault());
        } else {
            revert("Unknown challenge type");
        }
        
        emit ChallengeDeployed(challengeType, instance);
        return instance;
    }

    function setOwner(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}
