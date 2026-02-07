// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {YieldVault} from "../src/YieldVault.sol";

/// @notice Deploy MockUSDC + YieldVault implementation + VaultFactory on any testnet.
/// @dev Usage:
///   export PRIVATE_KEY=0x...
///   forge script script/DeployTestnet.s.sol --rpc-url base_sepolia --broadcast
///   forge script script/DeployTestnet.s.sol --rpc-url arbitrum_sepolia --broadcast
///   forge script script/DeployTestnet.s.sol --rpc-url op_sepolia --broadcast
contract DeployTestnet is Script {
    // LI.FI Diamond (same on all chains including testnets)
    address constant LIFI_DIAMOND = 0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerKey);

        // 1. Deploy MockUSDC
        MockUSDC mockUSDC = new MockUSDC();
        console.log("MockUSDC:", address(mockUSDC));

        // 2. Mint 1,000,000 mUSDC to deployer
        mockUSDC.mint(deployer, 1_000_000e6);
        console.log("Minted 1M mUSDC to deployer");

        // 3. Deploy YieldVault implementation (initializers auto-disabled)
        YieldVault impl = new YieldVault();
        console.log("YieldVault impl:", address(impl));

        // 4. Deploy VaultFactory with implementation address
        // deployer = agent = treasury for testnet
        VaultFactory factory = new VaultFactory(
            address(mockUSDC),
            deployer, // agentWallet
            deployer, // treasury
            LIFI_DIAMOND,
            address(impl)
        );
        console.log("VaultFactory:", address(factory));

        vm.stopBroadcast();

        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("MockUSDC:      ", address(mockUSDC));
        console.log("YieldVault impl:", address(impl));
        console.log("VaultFactory:  ", address(factory));
        console.log("Agent/Treasury:", deployer);
        console.log("LI.FI Diamond:", LIFI_DIAMOND);
    }
}
