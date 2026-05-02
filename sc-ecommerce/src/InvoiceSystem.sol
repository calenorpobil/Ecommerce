// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract InvoiceSystem {
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

    uint256 private _nextId = 1;
    mapping(uint256 => Invoice) private _invoices;
    mapping(uint256 => InvoiceItem[]) private _invoiceItems;
    mapping(address => uint256[]) private _customerInvoices;
    mapping(uint256 => uint256[]) private _companyInvoices;

    address public authorized;

    event InvoiceCreated(
        uint256 indexed invoiceId, address indexed customer, uint256 indexed companyId, uint256 totalAmount
    );
    event InvoicePaid(uint256 indexed invoiceId);
    event InvoiceRefunded(uint256 indexed invoiceId);

    error Unauthorized();
    error ZeroAddress();
    error InvoiceNotFound();
    error AlreadyPaid();
    error NotPaid();

    modifier onlyAuthorized() {
        if (msg.sender != authorized) revert Unauthorized();
        _;
    }

    constructor(address _authorized) {
        if (_authorized == address(0)) revert ZeroAddress();
        authorized = _authorized;
    }

    function createInvoice(
        address customer,
        uint256 companyId,
        InvoiceItem[] calldata items,
        uint256 totalAmount
    ) external onlyAuthorized returns (uint256) {
        uint256 id = _nextId++;
        _invoices[id] = Invoice({
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
            _invoiceItems[id].push(items[i]);
        }

        _customerInvoices[customer].push(id);
        _companyInvoices[companyId].push(id);

        emit InvoiceCreated(id, customer, companyId, totalAmount);
        return id;
    }

    function markAsPaid(uint256 invoiceId, string calldata txHash) external onlyAuthorized {
        Invoice storage inv = _invoices[invoiceId];
        if (inv.invoiceId == 0) revert InvoiceNotFound();
        if (inv.isPaid) revert AlreadyPaid();
        inv.isPaid = true;
        inv.paymentTxHash = txHash;
        emit InvoicePaid(invoiceId);
    }

    function markAsRefunded(uint256 invoiceId) external onlyAuthorized {
        Invoice storage inv = _invoices[invoiceId];
        if (inv.invoiceId == 0) revert InvoiceNotFound();
        if (!inv.isPaid) revert NotPaid();
        inv.isRefunded = true;
        emit InvoiceRefunded(invoiceId);
    }

    function getInvoice(uint256 invoiceId) external view returns (Invoice memory) {
        if (_invoices[invoiceId].invoiceId == 0) revert InvoiceNotFound();
        return _invoices[invoiceId];
    }

    function getInvoiceItems(uint256 invoiceId) external view returns (InvoiceItem[] memory) {
        return _invoiceItems[invoiceId];
    }

    function getCustomerInvoices(address customer) external view returns (uint256[] memory) {
        return _customerInvoices[customer];
    }

    function getCompanyInvoices(uint256 companyId) external view returns (uint256[] memory) {
        return _companyInvoices[companyId];
    }
}
