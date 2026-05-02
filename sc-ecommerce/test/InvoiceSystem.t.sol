// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {InvoiceSystem} from "../src/InvoiceSystem.sol";

contract InvoiceSystemTest is Test {
    InvoiceSystem invoiceSystem;
    address customer = makeAddr("customer");
    uint256 constant COMPANY_ID = 1;
    uint256 constant TOTAL = 20_000_000; // 20 EURT

    InvoiceSystem.InvoiceItem[] items;

    function setUp() public {
        invoiceSystem = new InvoiceSystem(address(this));
        items.push(
            InvoiceSystem.InvoiceItem({
                productId: 1,
                productName: "Widget",
                quantity: 2,
                unitPrice: 10_000_000,
                totalPrice: 20_000_000
            })
        );
    }

    function test_CreateInvoice() public {
        uint256 id = invoiceSystem.createInvoice(customer, COMPANY_ID, items, TOTAL);
        assertEq(id, 1);
        InvoiceSystem.Invoice memory inv = invoiceSystem.getInvoice(1);
        assertEq(inv.invoiceId, 1);
        assertEq(inv.customerAddress, customer);
        assertEq(inv.companyId, COMPANY_ID);
        assertEq(inv.totalAmount, TOTAL);
        assertEq(inv.timestamp, block.timestamp);
        assertFalse(inv.isPaid);
        assertFalse(inv.isRefunded);
    }

    function test_CreateInvoiceEmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit InvoiceSystem.InvoiceCreated(1, customer, COMPANY_ID, TOTAL);
        invoiceSystem.createInvoice(customer, COMPANY_ID, items, TOTAL);
    }

    function test_InvoiceHasItemsSnapshot() public {
        invoiceSystem.createInvoice(customer, COMPANY_ID, items, TOTAL);
        InvoiceSystem.InvoiceItem[] memory invoiceItems = invoiceSystem.getInvoiceItems(1);
        assertEq(invoiceItems.length, 1);
        assertEq(invoiceItems[0].productName, "Widget");
        assertEq(invoiceItems[0].quantity, 2);
        assertEq(invoiceItems[0].unitPrice, 10_000_000);
        assertEq(invoiceItems[0].totalPrice, 20_000_000);
    }

    function test_MarkAsPaid() public {
        invoiceSystem.createInvoice(customer, COMPANY_ID, items, TOTAL);
        invoiceSystem.markAsPaid(1, "0xdeadbeef");
        InvoiceSystem.Invoice memory inv = invoiceSystem.getInvoice(1);
        assertTrue(inv.isPaid);
        assertEq(inv.paymentTxHash, "0xdeadbeef");
    }

    function test_MarkAsPaidEmitsEvent() public {
        invoiceSystem.createInvoice(customer, COMPANY_ID, items, TOTAL);
        vm.expectEmit(true, false, false, false);
        emit InvoiceSystem.InvoicePaid(1);
        invoiceSystem.markAsPaid(1, "");
    }

    function test_RevertAlreadyPaid() public {
        invoiceSystem.createInvoice(customer, COMPANY_ID, items, TOTAL);
        invoiceSystem.markAsPaid(1, "");
        vm.expectRevert(InvoiceSystem.AlreadyPaid.selector);
        invoiceSystem.markAsPaid(1, "");
    }

    function test_MarkAsRefunded() public {
        invoiceSystem.createInvoice(customer, COMPANY_ID, items, TOTAL);
        invoiceSystem.markAsPaid(1, "");
        invoiceSystem.markAsRefunded(1);
        assertTrue(invoiceSystem.getInvoice(1).isRefunded);
    }

    function test_RefundEmitsEvent() public {
        invoiceSystem.createInvoice(customer, COMPANY_ID, items, TOTAL);
        invoiceSystem.markAsPaid(1, "");
        vm.expectEmit(true, false, false, false);
        emit InvoiceSystem.InvoiceRefunded(1);
        invoiceSystem.markAsRefunded(1);
    }

    function test_RevertRefundNotPaid() public {
        invoiceSystem.createInvoice(customer, COMPANY_ID, items, TOTAL);
        vm.expectRevert(InvoiceSystem.NotPaid.selector);
        invoiceSystem.markAsRefunded(1);
    }

    function test_GetCustomerInvoices() public {
        invoiceSystem.createInvoice(customer, COMPANY_ID, items, TOTAL);
        invoiceSystem.createInvoice(customer, COMPANY_ID, items, TOTAL);
        uint256[] memory ids = invoiceSystem.getCustomerInvoices(customer);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    function test_GetCompanyInvoices() public {
        invoiceSystem.createInvoice(customer, 1, items, TOTAL);
        invoiceSystem.createInvoice(customer, 2, items, TOTAL);
        invoiceSystem.createInvoice(customer, 1, items, TOTAL);
        assertEq(invoiceSystem.getCompanyInvoices(1).length, 2);
        assertEq(invoiceSystem.getCompanyInvoices(2).length, 1);
    }

    function test_MultipleInvoicesIncrementId() public {
        uint256 id1 = invoiceSystem.createInvoice(customer, COMPANY_ID, items, TOTAL);
        uint256 id2 = invoiceSystem.createInvoice(customer, COMPANY_ID, items, TOTAL);
        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_RevertInvoiceNotFound() public {
        vm.expectRevert(InvoiceSystem.InvoiceNotFound.selector);
        invoiceSystem.getInvoice(999);
    }

    function test_RevertMarkPaidNotFound() public {
        vm.expectRevert(InvoiceSystem.InvoiceNotFound.selector);
        invoiceSystem.markAsPaid(999, "");
    }

    function test_RevertUnauthorized() public {
        vm.prank(makeAddr("other"));
        vm.expectRevert(InvoiceSystem.Unauthorized.selector);
        invoiceSystem.createInvoice(customer, COMPANY_ID, items, TOTAL);
    }
}
