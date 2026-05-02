// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CustomerRegistry} from "../src/CustomerRegistry.sol";

contract CustomerRegistryTest is Test {
    CustomerRegistry registry;
    address customer1 = makeAddr("customer1");
    address customer2 = makeAddr("customer2");

    function setUp() public {
        registry = new CustomerRegistry(address(this));
    }

    function test_RegisterOrGet_NewCustomer() public {
        bool isNew = registry.registerOrGet(customer1);
        assertTrue(isNew);
        CustomerRegistry.Customer memory c = registry.getCustomer(customer1);
        assertEq(c.customerAddress, customer1);
        assertTrue(c.isActive);
        assertEq(c.totalPurchases, 0);
        assertEq(c.totalSpent, 0);
        assertEq(c.registrationDate, block.timestamp);
    }

    function test_RegisterOrGet_ExistingCustomer() public {
        registry.registerOrGet(customer1);
        bool isNew = registry.registerOrGet(customer1);
        assertFalse(isNew);
    }

    function test_RegisterEmitsEvent() public {
        vm.expectEmit(true, false, false, false);
        emit CustomerRegistry.CustomerRegistered(customer1);
        registry.registerOrGet(customer1);
    }

    function test_RecordPurchase() public {
        registry.registerOrGet(customer1);
        registry.recordPurchase(customer1, 100000000);
        CustomerRegistry.Customer memory c = registry.getCustomer(customer1);
        assertEq(c.totalPurchases, 1);
        assertEq(c.totalSpent, 100000000);
        assertGt(c.lastPurchaseDate, 0);
    }

    function test_RecordPurchaseAutoRegisters() public {
        assertFalse(registry.isRegistered(customer1));
        registry.recordPurchase(customer1, 50_000_000);
        assertTrue(registry.isRegistered(customer1));
        assertEq(registry.getCustomer(customer1).totalPurchases, 1);
    }

    function test_MultiplePurchasesAccumulate() public {
        registry.registerOrGet(customer1);
        registry.recordPurchase(customer1, 100_000_000);
        registry.recordPurchase(customer1, 200_000_000);
        CustomerRegistry.Customer memory c = registry.getCustomer(customer1);
        assertEq(c.totalPurchases, 2);
        assertEq(c.totalSpent, 300_000_000);
    }

    function test_PurchaseEmitsEvent() public {
        registry.registerOrGet(customer1);
        vm.expectEmit(true, false, false, true);
        emit CustomerRegistry.PurchaseRecorded(customer1, 1, 100_000_000);
        registry.recordPurchase(customer1, 100_000_000);
    }

    function test_IsRegistered() public {
        assertFalse(registry.isRegistered(customer1));
        registry.registerOrGet(customer1);
        assertTrue(registry.isRegistered(customer1));
    }

    function test_GetAllCustomers() public {
        registry.registerOrGet(customer1);
        registry.registerOrGet(customer2);
        assertEq(registry.getAllCustomers().length, 2);
    }

    function test_RevertZeroAddress() public {
        vm.expectRevert(CustomerRegistry.ZeroAddress.selector);
        registry.registerOrGet(address(0));
    }

    function test_RevertUnauthorized() public {
        vm.prank(makeAddr("other"));
        vm.expectRevert(CustomerRegistry.Unauthorized.selector);
        registry.registerOrGet(customer1);
    }
}
