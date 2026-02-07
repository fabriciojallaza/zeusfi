// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

/// @title VaultFactory
/// @notice Deploys one YieldVault per user per chain using ERC-1167 minimal proxy clones.
contract VaultFactory is Ownable {
    address public agentWallet;
    address public treasury;
    address public immutable usdc;
    address public immutable lifiDiamond;
    address public immutable implementation;

    /// user wallet → vault address
    mapping(address => address) public vaults;

    event VaultDeployed(address indexed user, address indexed vault);
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    error VaultAlreadyExists(address user, address vault);
    error ZeroAddress();

    constructor(
        address _usdc,
        address _agentWallet,
        address _treasury,
        address _lifiDiamond,
        address _implementation
    ) Ownable(msg.sender) {
        if (
            _usdc == address(0) || _agentWallet == address(0) || _treasury == address(0)
                || _lifiDiamond == address(0) || _implementation == address(0)
        ) {
            revert ZeroAddress();
        }
        usdc = _usdc;
        agentWallet = _agentWallet;
        treasury = _treasury;
        lifiDiamond = _lifiDiamond;
        implementation = _implementation;
    }

    /// @notice Deploy a vault for a user via ERC-1167 clone. Anyone can call (agent deploys on dest chain).
    /// @param user The wallet that will own the vault.
    /// @return vault The deployed vault address.
    function deployVault(address user) external returns (address vault) {
        if (user == address(0)) revert ZeroAddress();
        if (vaults[user] != address(0)) revert VaultAlreadyExists(user, vaults[user]);

        vault = Clones.clone(implementation);
        (bool ok,) = vault.call(
            abi.encodeWithSignature(
                "initialize(address,address,address,address,address)", user, usdc, agentWallet, treasury, lifiDiamond
            )
        );
        require(ok, "init failed");
        vaults[user] = vault;

        emit VaultDeployed(user, vault);
    }

    /// @notice Look up a user's vault.
    function getVault(address user) external view returns (address) {
        return vaults[user];
    }

    /// @notice Rotate agent key.
    function updateAgent(address _agentWallet) external onlyOwner {
        if (_agentWallet == address(0)) revert ZeroAddress();
        emit AgentUpdated(agentWallet, _agentWallet);
        agentWallet = _agentWallet;
    }

    /// @notice Change fee receiver.
    function updateTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }
}
