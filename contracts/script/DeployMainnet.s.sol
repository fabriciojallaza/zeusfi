// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VaultFactory} from "../src/VaultFactory.sol";

/// @notice Deploy VaultFactory on mainnet chains with real USDC.
/// @dev Usage:
///   export PRIVATE_KEY=0x...
///   forge script script/DeployMainnet.s.sol --rpc-url base --broadcast --verify
///   forge script script/DeployMainnet.s.sol --rpc-url arbitrum --broadcast --verify
///   forge script script/DeployMainnet.s.sol --rpc-url optimism --broadcast --verify
contract DeployMainnet is Script {
    // LI.FI Diamond (same on all chains)
    address constant LIFI_DIAMOND = 0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE;

    // Deployer / Agent / Treasury (MVP - same key)
    address constant AGENT_TREASURY = 0x6aEE0C194C256DE082e29475447Fd2d7134a6e44;

    // USDC addresses per chain
    function getUSDC() internal view returns (address) {
        if (block.chainid == 8453) {
            return 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913; // Base
        } else if (block.chainid == 42161) {
            return 0xaf88d065e77c8cC2239327C5EDb3A432268e5831; // Arbitrum
        } else if (block.chainid == 10) {
            return 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85; // Optimism
        } else {
            revert("Unsupported chain");
        }
    }

    function getChainName() internal view returns (string memory) {
        if (block.chainid == 8453) return "Base";
        if (block.chainid == 42161) return "Arbitrum";
        if (block.chainid == 10) return "Optimism";
        return "Unknown";
    }

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address usdc = getUSDC();

        console.log("=== MAINNET DEPLOYMENT ===");
        console.log("Chain:", getChainName());
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("USDC:", usdc);

        vm.startBroadcast(deployerKey);

        VaultFactory factory = new VaultFactory(
            usdc,
            AGENT_TREASURY, // agentWallet
            AGENT_TREASURY, // treasury
            LIFI_DIAMOND
        );

        vm.stopBroadcast();

        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("VaultFactory:", address(factory));
        console.log("USDC:        ", usdc);
        console.log("Agent:       ", AGENT_TREASURY);
        console.log("Treasury:    ", AGENT_TREASURY);
        console.log("LI.FI Diamond:", LIFI_DIAMOND);
    }
}
