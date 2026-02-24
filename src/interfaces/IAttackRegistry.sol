// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IAttackRegistry {
    enum AttackState {
        SAFE,
        UNDER_ATTACK,
        DEFENDED
    }

    function requestUnderAttack(address contractAddress) external;
    function getAttackState(address contractAddress) external view returns (AttackState);
    function isUnderAttack(address contractAddress) external view returns (bool);
}
