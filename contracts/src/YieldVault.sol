// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title YieldVault
/// @notice Per-user vault that holds USDC and lets an agent execute strategies via LI.FI.
contract YieldVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable owner;
    address public immutable lifiDiamond;
    address public usdc;
    address public agentWallet;
    address public treasury;

    /// @notice Tracks total user deposits for fee calculation.
    uint256 public principal;

    /// @notice Performance fee in basis points (1000 = 10%).
    uint256 public constant FEE_BPS = 1000;
    uint256 private constant BPS_DENOMINATOR = 10000;

    event Deposited(address indexed user, uint256 amount, uint256 newPrincipal);
    event Withdrawn(address indexed user, uint256 amount, uint256 fee);
    event StrategyExecuted(address indexed agent, address approveToken, uint256 approveAmount);
    event TokenRescued(address indexed token, uint256 amount);

    error OnlyOwner();
    error OnlyAgent();
    error ZeroAmount();
    error StrategyFailed();
    error CannotRescueUSDC();
    error NoBalance();

    modifier onlyOwner_() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyAgent() {
        if (msg.sender != agentWallet) revert OnlyAgent();
        _;
    }

    constructor(
        address _owner,
        address _usdc,
        address _agentWallet,
        address _treasury,
        address _lifiDiamond
    ) {
        owner = _owner;
        usdc = _usdc;
        agentWallet = _agentWallet;
        treasury = _treasury;
        lifiDiamond = _lifiDiamond;
    }

    // ─── Owner Functions ──────────────────────────────────────────────

    /// @notice Deposit USDC into the vault. Must approve first.
    function deposit(uint256 amount) external onlyOwner_ nonReentrant {
        if (amount == 0) revert ZeroAmount();
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), amount);
        principal += amount;
        emit Deposited(msg.sender, amount, principal);
    }

    /// @notice Withdraw all USDC. 10% fee on profit only.
    function withdraw() external onlyOwner_ nonReentrant {
        uint256 balance = IERC20(usdc).balanceOf(address(this));
        if (balance == 0) revert NoBalance();

        uint256 fee = 0;
        if (balance > principal) {
            uint256 profit = balance - principal;
            fee = (profit * FEE_BPS) / BPS_DENOMINATOR;
            IERC20(usdc).safeTransfer(treasury, fee);
        }

        uint256 payout = balance - fee;
        principal = 0;
        IERC20(usdc).safeTransfer(owner, payout);

        emit Withdrawn(msg.sender, payout, fee);
    }

    /// @notice Rescue non-USDC tokens stuck in vault.
    function rescueToken(address token) external onlyOwner_ nonReentrant {
        if (token == usdc) revert CannotRescueUSDC();
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert NoBalance();
        IERC20(token).safeTransfer(owner, balance);
        emit TokenRescued(token, balance);
    }

    // ─── Agent Functions ──────────────────────────────────────────────

    /// @notice Execute a strategy via LI.FI Diamond.
    /// @param approveToken Token to approve (address(0) to skip).
    /// @param approveAmount Amount to approve.
    /// @param lifiData Calldata for LI.FI Diamond.
    function executeStrategy(
        address approveToken,
        uint256 approveAmount,
        bytes calldata lifiData
    ) external onlyAgent nonReentrant {
        if (approveToken != address(0)) {
            IERC20(approveToken).forceApprove(lifiDiamond, approveAmount);
        }

        (bool success,) = lifiDiamond.call(lifiData);
        if (!success) revert StrategyFailed();

        emit StrategyExecuted(msg.sender, approveToken, approveAmount);
    }

    // ─── View Functions ───────────────────────────────────────────────

    /// @notice Current USDC balance in vault.
    function getBalance() external view returns (uint256) {
        return IERC20(usdc).balanceOf(address(this));
    }
}
