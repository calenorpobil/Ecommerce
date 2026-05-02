// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {EuroToken} from "../src/EuroToken.sol";

contract EuroTokenTest is Test {
    EuroToken public token;

    address public owner = makeAddr("owner");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    uint256 constant ONE_EURT = 1e6; // 1 EURT con 6 decimales
    uint256 constant MILLION_EURT = 1_000_000 * ONE_EURT;

    function setUp() public {
        token = new EuroToken(owner);
    }

    // ============================================================
    // Deploy
    // ============================================================

    function test_Deploy_Name() public view {
        assertEq(token.name(), "EuroToken");
    }

    function test_Deploy_Symbol() public view {
        assertEq(token.symbol(), "EURT");
    }

    function test_Deploy_Decimals() public view {
        assertEq(token.decimals(), 6);
    }

    function test_Deploy_Owner() public view {
        assertEq(token.owner(), owner);
    }

    function test_Deploy_InitialSupplyZero() public view {
        assertEq(token.totalSupply(), 0);
    }

    function test_Deploy_RevertZeroAddress() public {
        vm.expectRevert(EuroToken.ZeroAddress.selector);
        new EuroToken(address(0));
    }

    function test_Deploy_EmitsOwnershipTransferred() public {
        vm.expectEmit(true, true, false, false);
        emit EuroToken.OwnershipTransferred(address(0), owner);
        new EuroToken(owner);
    }

    // ============================================================
    // Mint
    // ============================================================

    function test_Mint_ByOwner() public {
        vm.prank(owner);
        token.mint(user1, ONE_EURT);

        assertEq(token.balanceOf(user1), ONE_EURT);
        assertEq(token.totalSupply(), ONE_EURT);
    }

    function test_Mint_EmitsTokensMinted() public {
        vm.expectEmit(true, false, false, true);
        emit EuroToken.TokensMinted(user1, ONE_EURT);

        vm.prank(owner);
        token.mint(user1, ONE_EURT);
    }

    function test_Mint_RevertNotOwner() public {
        vm.prank(user1);
        vm.expectRevert(EuroToken.OnlyOwner.selector);
        token.mint(user1, ONE_EURT);
    }

    function test_Mint_RevertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(EuroToken.ZeroAddress.selector);
        token.mint(address(0), ONE_EURT);
    }

    function test_Mint_RevertZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert(EuroToken.ZeroAmount.selector);
        token.mint(user1, 0);
    }

    function test_Mint_MultipleUsers() public {
        vm.startPrank(owner);
        token.mint(user1, ONE_EURT);
        token.mint(user2, 2 * ONE_EURT);
        vm.stopPrank();

        assertEq(token.balanceOf(user1), ONE_EURT);
        assertEq(token.balanceOf(user2), 2 * ONE_EURT);
        assertEq(token.totalSupply(), 3 * ONE_EURT);
    }

    // ============================================================
    // Transfers
    // ============================================================

    function test_Transfer_BetweenAccounts() public {
        vm.prank(owner);
        token.mint(user1, 10 * ONE_EURT);

        vm.prank(user1);
        assertTrue(token.transfer(user2, 4 * ONE_EURT));

        assertEq(token.balanceOf(user1), 6 * ONE_EURT);
        assertEq(token.balanceOf(user2), 4 * ONE_EURT);
    }

    function test_Transfer_RevertInsufficientBalance() public {
        vm.prank(owner);
        token.mint(user1, ONE_EURT);

        vm.startPrank(user1);
        vm.expectRevert();
        token.transfer(user2, 2 * ONE_EURT);
        vm.stopPrank();
        assertEq(token.balanceOf(user1), ONE_EURT);
    }

    function test_TransferFrom_WithApproval() public {
        vm.prank(owner);
        token.mint(user1, 10 * ONE_EURT);

        vm.prank(user1);
        token.approve(user2, 5 * ONE_EURT);

        vm.prank(user2);
        assertTrue(token.transferFrom(user1, user2, 5 * ONE_EURT));

        assertEq(token.balanceOf(user1), 5 * ONE_EURT);
        assertEq(token.balanceOf(user2), 5 * ONE_EURT);
        assertEq(token.allowance(user1, user2), 0);
    }

    function test_TransferFrom_RevertExceedsAllowance() public {
        vm.prank(owner);
        token.mint(user1, 10 * ONE_EURT);

        vm.prank(user1);
        token.approve(user2, ONE_EURT);

        vm.startPrank(user2);
        vm.expectRevert();
        token.transferFrom(user1, user2, 2 * ONE_EURT);
        vm.stopPrank();
        assertEq(token.balanceOf(user1), 10 * ONE_EURT);
    }

    // ============================================================
    // Burn
    // ============================================================

    function test_Burn_OwnTokens() public {
        vm.prank(owner);
        token.mint(user1, 10 * ONE_EURT);

        vm.prank(user1);
        token.burn(3 * ONE_EURT);

        assertEq(token.balanceOf(user1), 7 * ONE_EURT);
        assertEq(token.totalSupply(), 7 * ONE_EURT);
    }

    function test_Burn_EmitsTokensBurned() public {
        vm.prank(owner);
        token.mint(user1, ONE_EURT);

        vm.expectEmit(true, false, false, true);
        emit EuroToken.TokensBurned(user1, ONE_EURT);

        vm.prank(user1);
        token.burn(ONE_EURT);
    }

    function test_Burn_RevertZeroAmount() public {
        vm.prank(owner);
        token.mint(user1, ONE_EURT);

        vm.prank(user1);
        vm.expectRevert(EuroToken.ZeroAmount.selector);
        token.burn(0);
    }

    function test_Burn_RevertInsufficientBalance() public {
        vm.prank(owner);
        token.mint(user1, ONE_EURT);

        vm.prank(user1);
        vm.expectRevert();
        token.burn(2 * ONE_EURT);
    }

    // ============================================================
    // BurnFrom
    // ============================================================

    function test_BurnFrom_WithApproval() public {
        vm.prank(owner);
        token.mint(user1, 10 * ONE_EURT);

        vm.prank(user1);
        token.approve(user2, 5 * ONE_EURT);

        vm.prank(user2);
        token.burnFrom(user1, 5 * ONE_EURT);

        assertEq(token.balanceOf(user1), 5 * ONE_EURT);
        assertEq(token.totalSupply(), 5 * ONE_EURT);
        assertEq(token.allowance(user1, user2), 0);
    }

    function test_BurnFrom_EmitsTokensBurned() public {
        vm.prank(owner);
        token.mint(user1, ONE_EURT);

        vm.prank(user1);
        token.approve(user2, ONE_EURT);

        vm.expectEmit(true, false, false, true);
        emit EuroToken.TokensBurned(user1, ONE_EURT);

        vm.prank(user2);
        token.burnFrom(user1, ONE_EURT);
    }

    function test_BurnFrom_RevertZeroAddress() public {
        vm.prank(user1);
        vm.expectRevert(EuroToken.ZeroAddress.selector);
        token.burnFrom(address(0), ONE_EURT);
    }

    function test_BurnFrom_RevertZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert(EuroToken.ZeroAmount.selector);
        token.burnFrom(user1, 0);
    }

    function test_BurnFrom_RevertInsufficientAllowance() public {
        vm.prank(owner);
        token.mint(user1, 10 * ONE_EURT);

        vm.prank(user2);
        vm.expectRevert();
        token.burnFrom(user1, ONE_EURT);
    }

    // ============================================================
    // TransferOwnership
    // ============================================================

    function test_TransferOwnership() public {
        vm.prank(owner);
        token.transferOwnership(user1);

        assertEq(token.owner(), user1);
    }

    function test_TransferOwnership_EmitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit EuroToken.OwnershipTransferred(owner, user1);

        vm.prank(owner);
        token.transferOwnership(user1);
    }

    function test_TransferOwnership_NewOwnerCanMint() public {
        vm.prank(owner);
        token.transferOwnership(user1);

        vm.prank(user1);
        token.mint(user2, ONE_EURT);
        assertEq(token.balanceOf(user2), ONE_EURT);
    }

    function test_TransferOwnership_OldOwnerCannotMint() public {
        vm.prank(owner);
        token.transferOwnership(user1);

        vm.prank(owner);
        vm.expectRevert(EuroToken.OnlyOwner.selector);
        token.mint(user2, ONE_EURT);
    }

    function test_TransferOwnership_RevertNotOwner() public {
        vm.prank(user1);
        vm.expectRevert(EuroToken.OnlyOwner.selector);
        token.transferOwnership(user2);
    }

    function test_TransferOwnership_RevertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(EuroToken.ZeroAddress.selector);
        token.transferOwnership(address(0));
    }

    // ============================================================
    // Fuzz Tests
    // ============================================================

    function testFuzz_Mint(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(amount > 0 && amount <= MILLION_EURT);

        vm.prank(owner);
        token.mint(to, amount);
        assertEq(token.balanceOf(to), amount);
    }

    function testFuzz_BurnPartial(uint256 mintAmount, uint256 burnAmount) public {
        vm.assume(mintAmount > 0 && mintAmount <= MILLION_EURT);
        vm.assume(burnAmount > 0 && burnAmount <= mintAmount);

        vm.prank(owner);
        token.mint(user1, mintAmount);

        vm.prank(user1);
        token.burn(burnAmount);

        assertEq(token.balanceOf(user1), mintAmount - burnAmount);
    }
}
