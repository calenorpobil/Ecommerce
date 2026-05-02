// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PaymentGateway} from "../src/PaymentGateway.sol";
import {MockERC20} from "./helpers/MockERC20.sol";

contract PaymentGatewayTest is Test {
    PaymentGateway gateway;
    MockERC20 token;

    address customer = makeAddr("customer");
    address company = makeAddr("company");

    uint256 constant AMOUNT = 100_000_000; // 100 EURT

    function setUp() public {
        token = new MockERC20();
        gateway = new PaymentGateway(address(this), address(token));

        token.mint(customer, 1000_000_000); // 1000 EURT
        token.mint(company, 1000_000_000);
    }

    function test_ProcessPayment() public {
        vm.prank(customer);
        token.approve(address(gateway), AMOUNT);

        gateway.processPayment(customer, company, AMOUNT);

        assertEq(token.balanceOf(company), 1000_000_000 + AMOUNT);
        assertEq(token.balanceOf(customer), 1000_000_000 - AMOUNT);
    }

    function test_ProcessPaymentEmitsEvent() public {
        vm.prank(customer);
        token.approve(address(gateway), AMOUNT);

        vm.expectEmit(true, true, false, true);
        emit PaymentGateway.PaymentProcessed(customer, company, AMOUNT);
        gateway.processPayment(customer, company, AMOUNT);
    }

    function test_RevertInsufficientAllowance() public {
        vm.expectRevert(PaymentGateway.InsufficientAllowance.selector);
        gateway.processPayment(customer, company, AMOUNT);
    }

    function test_RevertInsufficientAllowancePartial() public {
        vm.prank(customer);
        token.approve(address(gateway), AMOUNT - 1);

        vm.expectRevert(PaymentGateway.InsufficientAllowance.selector);
        gateway.processPayment(customer, company, AMOUNT);
    }

    function test_RevertInsufficientBalance() public {
        address poorCustomer = makeAddr("poor");
        vm.prank(poorCustomer);
        token.approve(address(gateway), AMOUNT);

        vm.expectRevert(PaymentGateway.InsufficientBalance.selector);
        gateway.processPayment(poorCustomer, company, AMOUNT);
    }

    function test_Refund() public {
        vm.prank(company);
        token.approve(address(gateway), AMOUNT);

        gateway.refund(customer, company, AMOUNT);

        assertEq(token.balanceOf(customer), 1000_000_000 + AMOUNT);
        assertEq(token.balanceOf(company), 1000_000_000 - AMOUNT);
    }

    function test_RefundEmitsEvent() public {
        vm.prank(company);
        token.approve(address(gateway), AMOUNT);

        vm.expectEmit(true, true, false, true);
        emit PaymentGateway.Refunded(customer, company, AMOUNT);
        gateway.refund(customer, company, AMOUNT);
    }

    function test_RevertRefundInsufficientAllowance() public {
        vm.expectRevert(PaymentGateway.InsufficientAllowance.selector);
        gateway.refund(customer, company, AMOUNT);
    }

    function test_RevertRefundInsufficientBalance() public {
        address poorCompany = makeAddr("poorCompany");
        vm.prank(poorCompany);
        token.approve(address(gateway), AMOUNT);

        vm.expectRevert(PaymentGateway.InsufficientBalance.selector);
        gateway.refund(customer, poorCompany, AMOUNT);
    }

    function test_RevertUnauthorized() public {
        vm.prank(customer);
        token.approve(address(gateway), AMOUNT);

        vm.prank(customer);
        vm.expectRevert(PaymentGateway.Unauthorized.selector);
        gateway.processPayment(customer, company, AMOUNT);
    }

    function testFuzz_ProcessPayment(uint256 amount) public {
        vm.assume(amount > 0 && amount <= 1000_000_000);
        vm.prank(customer);
        token.approve(address(gateway), amount);

        gateway.processPayment(customer, company, amount);
        assertEq(token.balanceOf(customer), 1000_000_000 - amount);
    }
}
