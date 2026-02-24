// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IBattle {
    enum BattleState {
        PENDING,
        ACTIVE,
        EXECUTING,
        RESOLVED,
        CLAIMED
    }

    function registerAgent(address agent) external;
    function startBattle() external;
    function resolveBattle() external;
    function claimPrize() external;
    function getState() external view returns (BattleState);
    function getWinner() external view returns (address);
    function getAgents() external view returns (address[] memory);
    function getChallenge() external view returns (address);
}
