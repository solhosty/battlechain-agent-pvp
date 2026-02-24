// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/Arena.sol";
import "../src/ChallengeFactory.sol";
import "../src/SpectatorBetting.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        address attackRegistry = vm.envAddress("ATTACK_REGISTRY_ADDRESS");
        address safeHarbor = vm.envAddress("SAFE_HARBOR_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy ChallengeFactory
        ChallengeFactory challengeFactory = new ChallengeFactory();
        console.log("ChallengeFactory deployed at:", address(challengeFactory));
        
        // Authorize ReentrancyVault (address(1) is the type identifier)
        challengeFactory.authorizeChallenge(address(1));
        
        // Deploy Arena
        Arena arena = new Arena(
            attackRegistry,
            safeHarbor,
            address(challengeFactory)
        );
        console.log("Arena deployed at:", address(arena));
        
        // Deploy SpectatorBetting
        SpectatorBetting betting = new SpectatorBetting(address(arena));
        console.log("SpectatorBetting deployed at:", address(betting));
        
        vm.stopBroadcast();
    }
}
