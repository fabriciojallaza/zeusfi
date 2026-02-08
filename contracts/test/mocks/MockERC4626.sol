// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockUSDC} from "../../src/MockUSDC.sol";

/// @notice Minimal mock ERC-4626 vault for testing redeemShares.
///         Mints shares 1:1 with deposits, redeems 1:1 back to USDC.
contract MockERC4626 {
    MockUSDC public immutable asset_;
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;

    constructor(address _asset) {
        asset_ = MockUSDC(_asset);
    }

    function asset() external view returns (address) {
        return address(asset_);
    }

    function decimals() external pure returns (uint8) {
        return 6;
    }

    /// @notice Deposit USDC, get shares 1:1.
    function deposit(uint256 assets, address receiver) external returns (uint256) {
        IERC20(address(asset_)).transferFrom(msg.sender, address(this), assets);
        balanceOf[receiver] += assets;
        totalSupply += assets;
        return assets;
    }

    /// @notice Burn shares, send USDC 1:1 to receiver.
    function redeem(uint256 shares, address receiver, address owner_) external returns (uint256) {
        require(balanceOf[owner_] >= shares, "insufficient shares");
        balanceOf[owner_] -= shares;
        totalSupply -= shares;
        IERC20(address(asset_)).transfer(receiver, shares);
        return shares;
    }

    function convertToAssets(uint256 shares) external pure returns (uint256) {
        return shares; // 1:1
    }
}
