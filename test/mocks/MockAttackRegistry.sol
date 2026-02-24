// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../src/interfaces/IAttackRegistry.sol";

contract MockAttackRegistry is IAttackRegistry {
    mapping(address => AttackState) public attackStates;

    function requestUnderAttack(address contractAddress) external override {
        attackStates[contractAddress] = AttackState.UNDER_ATTACK;
    }

    function getAttackState(address contractAddress) external view override returns (AttackState) {
        return attackStates[contractAddress];
    }

    function isUnderAttack(address contractAddress) external view override returns (bool) {
        return attackStates[contractAddress] == AttackState.UNDER_ATTACK;
    }

    function setAttackState(address contractAddress, AttackState state) external {
        attackStates[contractAddress] = state;
    }
}
