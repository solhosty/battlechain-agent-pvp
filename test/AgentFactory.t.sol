// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/AgentFactory.sol";
import "./mocks/MockAgent.sol";

contract AgentFactoryTest is Test {
    AgentFactory public agentFactory;

    address public owner = address(1);
    address public creatorA = address(2);
    address public creatorB = address(3);

    function setUp() public {
        vm.prank(owner);
        agentFactory = new AgentFactory();
    }

    function testCreateAgentStoresByOwner() public {
        bytes memory bytecode = abi.encodePacked(
            type(MockAgent).creationCode,
            abi.encode("Agent1", owner, true, 0)
        );

        vm.prank(creatorA);
        address agent = agentFactory.createAgent("Agent1", bytecode);

        address[] memory agents = agentFactory.getAgentsByOwner(creatorA);
        assertEq(agents.length, 1);
        assertEq(agents[0], agent);
        assertEq(agentFactory.agentById(1), agent);
        assertEq(agentFactory.agentIds(0), 1);
        assertEq(agentFactory.getAgentCount(), 1);
    }

    function testCreateAgentEmptyBytecodeReverts() public {
        vm.prank(creatorA);
        vm.expectRevert("Empty bytecode");
        agentFactory.createAgent("Agent1", new bytes(0));
    }

    function testCreateAgentAnyCallerAllowed() public {
        bytes memory bytecode = abi.encodePacked(
            type(MockAgent).creationCode,
            abi.encode("Agent1", owner, true, 0)
        );

        vm.prank(creatorB);
        address agent = agentFactory.createAgent("Agent1", bytecode);

        address[] memory agents = agentFactory.getAgentsByOwner(creatorB);
        assertEq(agents.length, 1);
        assertEq(agents[0], agent);
    }

    function testCreateAgentDeterministicAddress() public {
        bytes memory bytecode = abi.encodePacked(
            type(MockAgent).creationCode,
            abi.encode("Agent1", owner, true, 0)
        );

        bytes32 salt = keccak256(abi.encode(creatorA, "Agent1", uint256(1)));
        address expected = _computeCreate2Address(
            salt,
            keccak256(bytecode),
            address(agentFactory)
        );

        vm.prank(creatorA);
        address agent = agentFactory.createAgent("Agent1", bytecode);

        assertEq(agent, expected);
    }

    function _computeCreate2Address(
        bytes32 salt,
        bytes32 bytecodeHash,
        address deployer
    ) internal pure returns (address) {
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(bytes1(0xff), deployer, salt, bytecodeHash)
                    )
                )
            )
        );
    }
}
