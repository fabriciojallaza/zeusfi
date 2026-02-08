// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {YieldVault} from "../src/YieldVault.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {MockERC4626} from "./mocks/MockERC4626.sol";

contract YieldVaultTest is Test {
    VaultFactory factory;
    MockUSDC usdc;

    address deployer = address(0x1);
    address agent = address(0x2);
    address treasury = address(0x3);
    address user = address(0x4);
    address attacker = address(0x5);
    address lifiDiamond = address(0x6666);

    function setUp() public {
        vm.startPrank(deployer);
        usdc = new MockUSDC();
        YieldVault impl = new YieldVault();
        factory = new VaultFactory(address(usdc), agent, treasury, lifiDiamond, address(impl));
        vm.stopPrank();

        // Give user some USDC
        usdc.mint(user, 10_000e6);
    }

    // ─── Factory Tests ────────────────────────────────────────────────

    function test_deployVault() public {
        address vault = factory.deployVault(user);
        assertTrue(vault != address(0), "vault should be non-zero");
        assertEq(factory.getVault(user), vault, "getVault should return deployed address");
    }

    function test_deployVault_revertsOnDuplicate() public {
        factory.deployVault(user);
        vm.expectRevert(abi.encodeWithSelector(VaultFactory.VaultAlreadyExists.selector, user, factory.getVault(user)));
        factory.deployVault(user);
    }

    function test_deployVault_revertsOnZeroAddress() public {
        vm.expectRevert(VaultFactory.ZeroAddress.selector);
        factory.deployVault(address(0));
    }

    function test_getVault_returnsZeroForUnknownUser() public view {
        assertEq(factory.getVault(address(0xDEAD)), address(0));
    }

    // ─── Deposit Tests ────────────────────────────────────────────────

    function test_deposit() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);

        vm.startPrank(user);
        usdc.approve(vaultAddr, 1000e6);
        vault.deposit(1000e6);
        vm.stopPrank();

        assertEq(vault.principal(), 1000e6, "principal should be 1000");
        assertEq(vault.getBalance(), 1000e6, "balance should be 1000");
    }

    function test_deposit_revertsForNonOwner() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);

        vm.startPrank(attacker);
        usdc.mint(attacker, 1000e6);
        usdc.approve(vaultAddr, 1000e6);
        vm.expectRevert(YieldVault.OnlyOwner.selector);
        vault.deposit(1000e6);
        vm.stopPrank();
    }

    function test_deposit_revertsOnZeroAmount() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);

        vm.prank(user);
        vm.expectRevert(YieldVault.ZeroAmount.selector);
        vault.deposit(0);
    }

    // ─── Withdraw Tests ───────────────────────────────────────────────

    function test_withdraw_noProfit() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);

        vm.startPrank(user);
        usdc.approve(vaultAddr, 1000e6);
        vault.deposit(1000e6);

        uint256 balBefore = usdc.balanceOf(user);
        vault.withdraw();
        uint256 balAfter = usdc.balanceOf(user);
        vm.stopPrank();

        assertEq(balAfter - balBefore, 1000e6, "user should get back 1000");
        assertEq(usdc.balanceOf(treasury), 0, "no fee on zero profit");
        assertEq(vault.principal(), 0, "principal should be reset");
    }

    function test_withdraw_withProfit() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);

        vm.startPrank(user);
        usdc.approve(vaultAddr, 1000e6);
        vault.deposit(1000e6);
        vm.stopPrank();

        // Simulate profit: send extra 100 USDC to vault
        usdc.mint(vaultAddr, 100e6);

        vm.prank(user);
        vault.withdraw();

        // Profit = 100 USDC, Fee = 10% of 100 = 10
        assertEq(usdc.balanceOf(treasury), 10e6, "treasury gets 10 USDC fee");
        // User gets 1100 - 10 = 1090
        // user started with 10000, deposited 1000 (9000 left), gets 1090 back
        assertEq(usdc.balanceOf(user), 9000e6 + 1090e6, "user gets 1090 back");
    }

    function test_withdraw_atLoss() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);

        vm.startPrank(user);
        usdc.approve(vaultAddr, 1000e6);
        vault.deposit(1000e6);
        vm.stopPrank();

        // Simulate loss: remove 100 USDC from vault
        vm.prank(vaultAddr);
        usdc.transfer(address(0xDEAD), 100e6);

        vm.prank(user);
        vault.withdraw();

        assertEq(usdc.balanceOf(treasury), 0, "no fee at loss");
        assertEq(usdc.balanceOf(user), 9000e6 + 900e6, "user gets 900 back");
    }

    function test_withdraw_revertsForNonOwner() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);

        vm.startPrank(user);
        usdc.approve(vaultAddr, 1000e6);
        vault.deposit(1000e6);
        vm.stopPrank();

        vm.prank(attacker);
        vm.expectRevert(YieldVault.OnlyOwner.selector);
        vault.withdraw();
    }

    function test_withdraw_revertsOnNoBalance() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);

        vm.prank(user);
        vm.expectRevert(YieldVault.NoBalance.selector);
        vault.withdraw();
    }

    // ─── ExecuteStrategy Tests ────────────────────────────────────────

    function test_executeStrategy_agentCanCall() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);

        // Deposit first
        vm.startPrank(user);
        usdc.approve(vaultAddr, 1000e6);
        vault.deposit(1000e6);
        vm.stopPrank();

        // Mock lifiDiamond to accept any call and return success
        vm.etch(lifiDiamond, hex"00");
        vm.mockCall(lifiDiamond, bytes(""), abi.encode(true));

        vm.prank(agent);
        vault.executeStrategy(address(usdc), 500e6, hex"1234");

        // Check approval was set
        assertEq(usdc.allowance(vaultAddr, lifiDiamond), 500e6);
    }

    function test_executeStrategy_revertsForNonAgent() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);

        vm.prank(attacker);
        vm.expectRevert(YieldVault.OnlyAgent.selector);
        vault.executeStrategy(address(0), 0, hex"1234");
    }

    function test_executeStrategy_revertsOnFailedCall() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);

        // Mock lifiDiamond to fail
        vm.mockCallRevert(lifiDiamond, bytes(""), bytes(""));

        vm.prank(agent);
        vm.expectRevert(YieldVault.StrategyFailed.selector);
        vault.executeStrategy(address(0), 0, hex"1234");
    }

    function test_executeStrategy_skipsApproveWhenZeroAddress() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);

        vm.etch(lifiDiamond, hex"00");
        vm.mockCall(lifiDiamond, bytes(""), abi.encode(true));

        vm.prank(agent);
        vault.executeStrategy(address(0), 0, hex"1234");
        // No revert = success, approval was skipped
    }

    function test_executeStrategy_targetIsAlwaysLifiDiamond() public {
        // lifiDiamond is set once via initialize() and cannot be changed
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);
        assertEq(vault.lifiDiamond(), lifiDiamond);
    }

    // ─── RescueToken Tests ────────────────────────────────────────────

    function test_rescueToken() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);

        // Create a fake token stuck in vault
        MockUSDC fakeToken = new MockUSDC();
        fakeToken.mint(vaultAddr, 500e6);

        vm.prank(user);
        vault.rescueToken(address(fakeToken));

        assertEq(fakeToken.balanceOf(user), 500e6, "user should recover token");
        assertEq(fakeToken.balanceOf(vaultAddr), 0, "vault should be empty");
    }

    function test_rescueToken_revertsForUSDC() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);

        vm.prank(user);
        vm.expectRevert(YieldVault.CannotRescueUSDC.selector);
        vault.rescueToken(address(usdc));
    }

    function test_rescueToken_revertsForNonOwner() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);

        vm.prank(attacker);
        vm.expectRevert(YieldVault.OnlyOwner.selector);
        vault.rescueToken(address(usdc));
    }

    // ─── Admin Tests ──────────────────────────────────────────────────

    function test_updateAgent() public {
        address newAgent = address(0xA1);

        vm.prank(deployer);
        factory.updateAgent(newAgent);

        assertEq(factory.agentWallet(), newAgent);
    }

    function test_updateAgent_revertsForNonOwner() public {
        vm.prank(attacker);
        vm.expectRevert();
        factory.updateAgent(address(0xA1));
    }

    function test_updateTreasury() public {
        address newTreasury = address(0xB1);

        vm.prank(deployer);
        factory.updateTreasury(newTreasury);

        assertEq(factory.treasury(), newTreasury);
    }

    function test_updateTreasury_revertsForNonOwner() public {
        vm.prank(attacker);
        vm.expectRevert();
        factory.updateTreasury(address(0xB1));
    }

    function test_updateAgent_revertsOnZeroAddress() public {
        vm.prank(deployer);
        vm.expectRevert(VaultFactory.ZeroAddress.selector);
        factory.updateAgent(address(0));
    }

    function test_updateTreasury_revertsOnZeroAddress() public {
        vm.prank(deployer);
        vm.expectRevert(VaultFactory.ZeroAddress.selector);
        factory.updateTreasury(address(0));
    }

    // ─── Constructor Validation ───────────────────────────────────────

    function test_constructor_revertsOnZeroUSDC() public {
        YieldVault impl = new YieldVault();
        vm.prank(deployer);
        vm.expectRevert(VaultFactory.ZeroAddress.selector);
        new VaultFactory(address(0), agent, treasury, lifiDiamond, address(impl));
    }

    function test_constructor_revertsOnZeroAgent() public {
        YieldVault impl = new YieldVault();
        vm.prank(deployer);
        vm.expectRevert(VaultFactory.ZeroAddress.selector);
        new VaultFactory(address(usdc), address(0), treasury, lifiDiamond, address(impl));
    }

    // ─── Vault Storage Values ─────────────────────────────────────────

    function test_vaultStorageValues() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);

        assertEq(vault.owner(), user);
        assertEq(vault.lifiDiamond(), lifiDiamond);
        assertEq(vault.usdc(), address(usdc));
        assertEq(vault.agentWallet(), agent);
        assertEq(vault.treasury(), treasury);
    }

    // ─── Clone / Initializable Tests ──────────────────────────────────

    function test_cannotReinitialize() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);
        vm.expectRevert();
        vault.initialize(attacker, address(usdc), agent, treasury, lifiDiamond);
    }

    function test_implementationCannotBeInitialized() public {
        address impl = factory.implementation();
        YieldVault vault = YieldVault(impl);
        vm.expectRevert();
        vault.initialize(user, address(usdc), agent, treasury, lifiDiamond);
    }

    // ─── RedeemShares Tests ──────────────────────────────────────────

    function _setupVaultWithERC4626() internal returns (YieldVault vault, MockERC4626 mockVault) {
        address vaultAddr = factory.deployVault(user);
        vault = YieldVault(vaultAddr);
        mockVault = new MockERC4626(address(usdc));

        // User deposits USDC into YieldVault
        vm.startPrank(user);
        usdc.approve(vaultAddr, 1000e6);
        vault.deposit(1000e6);
        vm.stopPrank();

        // Simulate: agent deployed USDC into ERC-4626 vault
        // Transfer USDC from YieldVault to MockERC4626, mint shares to YieldVault
        vm.prank(vaultAddr);
        usdc.approve(address(mockVault), 500e6);
        vm.prank(vaultAddr);
        mockVault.deposit(500e6, vaultAddr);
    }

    function test_redeemShares_agentCanCall() public {
        (YieldVault vault, MockERC4626 mockVault) = _setupVaultWithERC4626();
        address vaultAddr = address(vault);

        assertEq(mockVault.balanceOf(vaultAddr), 500e6, "vault should hold 500 shares");
        assertEq(vault.getBalance(), 500e6, "vault USDC should be 500 (other 500 in protocol)");

        vm.prank(agent);
        vault.redeemShares(address(mockVault), 500e6);

        assertEq(mockVault.balanceOf(vaultAddr), 0, "shares should be burned");
        assertEq(vault.getBalance(), 1000e6, "all USDC should be back in vault");
    }

    function test_redeemShares_zeroSharesRedeemsAll() public {
        (YieldVault vault, MockERC4626 mockVault) = _setupVaultWithERC4626();
        address vaultAddr = address(vault);

        vm.prank(agent);
        vault.redeemShares(address(mockVault), 0); // 0 = redeem all

        assertEq(mockVault.balanceOf(vaultAddr), 0, "all shares should be burned");
        assertEq(vault.getBalance(), 1000e6, "all USDC should be back in vault");
    }

    function test_redeemShares_revertsForNonAgent() public {
        (YieldVault vault, MockERC4626 mockVault) = _setupVaultWithERC4626();

        vm.prank(attacker);
        vm.expectRevert(YieldVault.OnlyAgent.selector);
        vault.redeemShares(address(mockVault), 500e6);
    }

    function test_redeemShares_revertsForZeroAddress() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);

        vm.prank(agent);
        vm.expectRevert(YieldVault.ZeroAddress.selector);
        vault.redeemShares(address(0), 0);
    }

    function test_redeemShares_revertsWhenNoShares() public {
        address vaultAddr = factory.deployVault(user);
        YieldVault vault = YieldVault(vaultAddr);
        MockERC4626 mockVault = new MockERC4626(address(usdc));

        vm.prank(agent);
        vm.expectRevert(YieldVault.ZeroAmount.selector);
        vault.redeemShares(address(mockVault), 0); // no shares held
    }
}
