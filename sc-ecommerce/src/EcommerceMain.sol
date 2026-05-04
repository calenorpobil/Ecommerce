// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CompanyLib} from "./libraries/CompanyLib.sol";
import {ProductLib} from "./libraries/ProductLib.sol";
import {CustomerLib} from "./libraries/CustomerLib.sol";
import {CartLib} from "./libraries/CartLib.sol";
import {InvoiceLib} from "./libraries/InvoiceLib.sol";
import {PaymentLib} from "./libraries/PaymentLib.sol";

contract EcommerceMain {
    using CompanyLib for CompanyLib.Data;
    using ProductLib for ProductLib.Data;
    using CustomerLib for CustomerLib.Data;
    using CartLib for CartLib.Data;
    using InvoiceLib for InvoiceLib.Data;

    // ─── Storage ───────────────────────────────────────────────────────────
    CompanyLib.Data private _companies;
    ProductLib.Data private _products;
    CustomerLib.Data private _customers;
    CartLib.Data private _carts;
    InvoiceLib.Data private _invoices;

    address public owner;
    address private _euroToken;

    // ─── Events ────────────────────────────────────────────────────────────
    event CompanyRegistered(uint256 indexed companyId, address indexed companyAddress);
    event ProductAdded(uint256 indexed productId, uint256 indexed companyId);
    event CartUpdated(address indexed customer);
    event InvoiceCreated(uint256 indexed invoiceId, address indexed customer, uint256 indexed companyId);
    event PaymentProcessed(uint256 indexed invoiceId, uint256 amount);
    event Refunded(uint256 indexed invoiceId);

    // ─── Errors ────────────────────────────────────────────────────────────
    error OnlyOwner();
    error NotAuthorized();
    error CompanyInactive();
    error ProductInactive();
    error InsufficientStock();
    error EmptyCart();
    error MixedCompanies();
    error InvoiceAlreadyPaid();
    error NotInvoiceOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address euroTokenAddress) {
        owner = msg.sender;
        _euroToken = euroTokenAddress;
    }

    // ─── Company ───────────────────────────────────────────────────────────

    function registerCompany(
        address companyAddress,
        string calldata name,
        string calldata description,
        string calldata taxId
    ) external returns (uint256 companyId) {
        companyId = _companies.register(companyAddress, name, description, taxId);
        emit CompanyRegistered(companyId, companyAddress);
    }

    function deactivateCompany(uint256 companyId) external {
        CompanyLib.Company memory c = _companies.get(companyId);
        if (msg.sender != owner && msg.sender != c.companyAddress) revert NotAuthorized();
        _companies.deactivate(companyId);
    }

    // ─── Products ──────────────────────────────────────────────────────────

    function addProduct(
        uint256 companyId,
        string calldata name,
        string calldata description,
        uint256 price,
        uint256 stock,
        string calldata ipfsImageHash
    ) external returns (uint256 productId) {
        CompanyLib.Company memory c = _companies.get(companyId);
        if (!c.isActive) revert CompanyInactive();
        if (msg.sender != c.companyAddress && msg.sender != owner) revert NotAuthorized();

        productId = _products.add(companyId, name, description, price, stock, ipfsImageHash);
        emit ProductAdded(productId, companyId);
    }

    function updateProduct(
        uint256 productId,
        string calldata name,
        string calldata description,
        uint256 price,
        string calldata ipfsImageHash
    ) external {
        _requireCompanyOwner(productId);
        _products.update(productId, name, description, price, ipfsImageHash);
    }

    function updateStock(uint256 productId, uint256 newStock) external {
        _requireCompanyOwner(productId);
        _products.setStock(productId, newStock);
    }

    function deactivateProduct(uint256 productId) external {
        _requireCompanyOwner(productId);
        _products.deactivate(productId);
    }

    // ─── Cart ──────────────────────────────────────────────────────────────

    function addToCart(uint256 productId, uint256 quantity) external {
        ProductLib.Product memory p = _products.get(productId);
        if (!p.isActive) revert ProductInactive();
        if (p.stock < quantity) revert InsufficientStock();

        _customers.registerOrGet(msg.sender);
        _carts.add(msg.sender, productId, quantity, p.price);
        emit CartUpdated(msg.sender);
    }

    function updateCartQuantity(uint256 productId, uint256 quantity) external {
        ProductLib.Product memory p = _products.get(productId);
        if (p.stock < quantity) revert InsufficientStock();
        _carts.updateQuantity(msg.sender, productId, quantity);
        emit CartUpdated(msg.sender);
    }

    function removeFromCart(uint256 productId) external {
        _carts.remove(msg.sender, productId);
        emit CartUpdated(msg.sender);
    }

    function calculateTotal() external view returns (uint256) {
        return _carts.calculateTotal(msg.sender);
    }

    // ─── Invoice ───────────────────────────────────────────────────────────

    function createInvoice(uint256 companyId) external returns (uint256 invoiceId) {
        CartLib.CartItem[] memory items = _carts.getCart(msg.sender);
        if (items.length == 0) revert EmptyCart();

        InvoiceLib.InvoiceItem[] memory invoiceItems = new InvoiceLib.InvoiceItem[](items.length);
        uint256 total = 0;

        for (uint256 i = 0; i < items.length; i++) {
            ProductLib.Product memory p = _products.get(items[i].productId);
            if (p.companyId != companyId) revert MixedCompanies();

            uint256 lineTotal = items[i].quantity * items[i].unitPrice;
            invoiceItems[i] = InvoiceLib.InvoiceItem({
                productId: items[i].productId,
                productName: p.name,
                quantity: items[i].quantity,
                unitPrice: items[i].unitPrice,
                totalPrice: lineTotal
            });
            total += lineTotal;
        }

        invoiceId = _invoices.create(msg.sender, companyId, invoiceItems, total);
        _carts.clear(msg.sender);

        emit InvoiceCreated(invoiceId, msg.sender, companyId);
    }

    // ─── Payment ───────────────────────────────────────────────────────────

    function processPayment(uint256 invoiceId) external {
        InvoiceLib.Invoice memory inv = _invoices.get(invoiceId);
        if (inv.isPaid) revert InvoiceAlreadyPaid();
        if (inv.customerAddress != msg.sender) revert NotInvoiceOwner();

        CompanyLib.Company memory company = _companies.get(inv.companyId);

        PaymentLib.processPayment(_euroToken, msg.sender, company.companyAddress, inv.totalAmount);
        _invoices.markAsPaid(invoiceId, "");

        InvoiceLib.InvoiceItem[] memory items = _invoices.getItems(invoiceId);
        for (uint256 i = 0; i < items.length; i++) {
            _products.decreaseStock(items[i].productId, items[i].quantity);
        }

        _customers.recordPurchase(msg.sender, inv.totalAmount);
        emit PaymentProcessed(invoiceId, inv.totalAmount);
    }

    function refund(uint256 invoiceId) external {
        InvoiceLib.Invoice memory inv = _invoices.get(invoiceId);
        CompanyLib.Company memory company = _companies.get(inv.companyId);
        if (msg.sender != company.companyAddress && msg.sender != owner) revert NotAuthorized();

        PaymentLib.refund(_euroToken, inv.customerAddress, company.companyAddress, inv.totalAmount);
        _invoices.markAsRefunded(invoiceId);
        emit Refunded(invoiceId);
    }

    // ─── Views ─────────────────────────────────────────────────────────────

    function getCompany(uint256 companyId) external view returns (CompanyLib.Company memory) {
        return _companies.get(companyId);
    }

    function getCompanyIdByAddress(address companyAddress) external view returns (uint256) {
        return _companies.getIdByAddress(companyAddress);
    }

    function getProduct(uint256 productId) external view returns (ProductLib.Product memory) {
        return _products.get(productId);
    }

    function getProductsByCompany(uint256 companyId) external view returns (uint256[] memory) {
        return _products.getByCompany(companyId);
    }

    function getCart() external view returns (CartLib.CartItem[] memory) {
        return _carts.getCart(msg.sender);
    }

    function getInvoice(uint256 invoiceId) external view returns (InvoiceLib.Invoice memory) {
        return _invoices.get(invoiceId);
    }

    function getInvoiceItems(uint256 invoiceId) external view returns (InvoiceLib.InvoiceItem[] memory) {
        return _invoices.getItems(invoiceId);
    }

    function getCustomerInvoices(address customer) external view returns (uint256[] memory) {
        return _invoices.getCustomerInvoices(customer);
    }

    function getCustomer(address customer) external view returns (CustomerLib.Customer memory) {
        return _customers.get(customer);
    }

    function getAllCompanyIds() external view returns (uint256[] memory) {
        return _companies.ids;
    }

    function getCompanyInvoices(uint256 companyId) external view returns (uint256[] memory) {
        return _invoices.getCompanyInvoices(companyId);
    }

    function getAllCustomers() external view returns (address[] memory) {
        return _customers.addresses;
    }

    // ─── Internal ──────────────────────────────────────────────────────────

    function _requireCompanyOwner(uint256 productId) internal view {
        ProductLib.Product memory p = _products.get(productId);
        CompanyLib.Company memory c = _companies.get(p.companyId);
        if (msg.sender != c.companyAddress && msg.sender != owner) revert NotAuthorized();
    }
}
