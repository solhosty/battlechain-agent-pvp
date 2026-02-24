// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ISafeHarbor {
    struct BountyTerms {
        uint256 maxBounty;
        uint256 minBounty;
        address[] scopeContracts;
        bool active;
    }

    function registerSafeHarbor(BountyTerms calldata terms) external;
    function getBountyTerms(address contractAddress) external view returns (BountyTerms memory);
    function isInScope(address contractAddress, address target) external view returns (bool);
    function validateAttack(address contractAddress, address attacker) external view returns (bool);
}
