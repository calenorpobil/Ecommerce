// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library InvoiceLib {
    struct Invoice {
        uint256 invoiceId;
        uint256 companyId;
        address customerAddress;
        uint256 totalAmount;
        uint256 timestamp;
        bool isPaid;
        bool isRefunded;
        string paymentTxHash;
    }

    struct InvoiceItem {
        uint256 productId;
        string productName;
        uint256 quantity;
        uint256 unitPrice;
        uint256 totalPrice;
    }

    struct Data {
        uint256 nextId;
        mapping(uint256 => Invoice) invoices;
        mapping(uint256 => InvoiceItem[]) invoiceItems;
        mapping(address => uint256[]) customerInvoices;
        mapping(uint256 => uint256[]) companyInvoices;
    }

    error InvoiceNotFound();
    error AlreadyPaid();
    error NotPaid();

    function create(
        Data storage self,
        address customer,
        uint256 companyId,
        InvoiceItem[] memory items,
        uint256 totalAmount
    ) internal returns (uint256) {
        uint256 id = ++self.nextId;
        self.invoices[id] = Invoice({
            invoiceId: id,
            companyId: companyId,
            customerAddress: customer,
            totalAmount: totalAmount,
            timestamp: block.timestamp,
            isPaid: false,
            isRefunded: false,
            paymentTxHash: ""
        });

        for (uint256 i = 0; i < items.length; i++) {
            self.invoiceItems[id].push(items[i]);
        }

        self.customerInvoices[customer].push(id);
        self.companyInvoices[companyId].push(id);
        return id;
    }

    function markAsPaid(Data storage self, uint256 invoiceId, string memory txHash) internal {
        Invoice storage inv = self.invoices[invoiceId];
        if (inv.invoiceId == 0) revert InvoiceNotFound();
        if (inv.isPaid) revert AlreadyPaid();
        inv.isPaid = true;
        inv.paymentTxHash = txHash;
    }

    function markAsRefunded(Data storage self, uint256 invoiceId) internal {
        Invoice storage inv = self.invoices[invoiceId];
        if (inv.invoiceId == 0) revert InvoiceNotFound();
        if (!inv.isPaid) revert NotPaid();
        inv.isRefunded = true;
    }

    function get(Data storage self, uint256 invoiceId) internal view returns (Invoice memory) {
        if (self.invoices[invoiceId].invoiceId == 0) revert InvoiceNotFound();
        return self.invoices[invoiceId];
    }

    function getItems(Data storage self, uint256 invoiceId) internal view returns (InvoiceItem[] memory) {
        return self.invoiceItems[invoiceId];
    }

    function getCustomerInvoices(Data storage self, address customer) internal view returns (uint256[] memory) {
        return self.customerInvoices[customer];
    }

    function getCompanyInvoices(Data storage self, uint256 companyId) internal view returns (uint256[] memory) {
        return self.companyInvoices[companyId];
    }
}
