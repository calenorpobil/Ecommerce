// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CompanyRegistry} from "./CompanyRegistry.sol";
import {ProductCatalog} from "./ProductCatalog.sol";
import {CustomerRegistry} from "./CustomerRegistry.sol";
import {ShoppingCart} from "./ShoppingCart.sol";
import {InvoiceSystem} from "./InvoiceSystem.sol";
import {PaymentGateway} from "./PaymentGateway.sol";

contract EcommerceMain {
    CompanyRegistry public companyRegistry;
    ProductCatalog public productCatalog;
    CustomerRegistry public customerRegistry;
    ShoppingCart public shoppingCart;
    InvoiceSystem public invoiceSystem;
    PaymentGateway public paymentGateway;

    address public owner;

    event CompanyRegistered(uint256 indexed companyId, address indexed companyAddress);
    event ProductAdded(uint256 indexed productId, uint256 indexed companyId);
    event CartUpdated(address indexed customer);
    event InvoiceCreated(uint256 indexed invoiceId, address indexed customer, uint256 indexed companyId);
    event PaymentProcessed(uint256 indexed invoiceId, uint256 amount);
    event Refunded(uint256 indexed invoiceId);

    error OnlyOwner();
    error NotAuthorized();
    error CompanyInactive();
    error ProductInactive();
    error InsufficientStock();
    error EmptyCart();
    error MixedCompanies();
    error InvoiceAlreadyPaid();
    error NotInvoiceOwner();
    error AlreadyInitialized();
    error NotInitialized();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier whenInitialized() {
        if (address(companyRegistry) == address(0)) revert NotInitialized();
        _;
    }

    address private _euroTokenAddress;
    bool public initialized;

    constructor(address euroTokenAddress) {
        owner = msg.sender;
        _euroTokenAddress = euroTokenAddress;
    }

    // Deploys the 6 sub-contracts. Called once after constructor to keep
    // constructor gas low enough for reliable RPC deployment.
    function initialize() external onlyOwner {
        if (initialized) revert AlreadyInitialized();
        initialized = true;
        companyRegistry = new CompanyRegistry(address(this));
        productCatalog = new ProductCatalog(address(this));
        customerRegistry = new CustomerRegistry(address(this));
        shoppingCart = new ShoppingCart(address(this));
        invoiceSystem = new InvoiceSystem(address(this));
        paymentGateway = new PaymentGateway(address(this), _euroTokenAddress);
    }

    // ─── Company ───────────────────────────────────────────────────────────

    function registerCompany(
        address companyAddress,
        string calldata name,
        string calldata description,
        string calldata taxId
    ) external returns (uint256 companyId) {
        companyId = companyRegistry.registerCompany(companyAddress, name, description, taxId);
        emit CompanyRegistered(companyId, companyAddress);
    }

    function deactivateCompany(uint256 companyId) external {
        CompanyRegistry.Company memory c = companyRegistry.getCompany(companyId);
        if (msg.sender != owner && msg.sender != c.companyAddress) revert NotAuthorized();
        companyRegistry.deactivateCompany(companyId);
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
        CompanyRegistry.Company memory c = companyRegistry.getCompany(companyId);
        if (!c.isActive) revert CompanyInactive();
        if (msg.sender != c.companyAddress && msg.sender != owner) revert NotAuthorized();

        productId = productCatalog.addProduct(companyId, name, description, price, stock, ipfsImageHash);
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
        productCatalog.updateProduct(productId, name, description, price, ipfsImageHash);
    }

    function updateStock(uint256 productId, uint256 newStock) external {
        _requireCompanyOwner(productId);
        productCatalog.updateStock(productId, newStock);
    }

    function deactivateProduct(uint256 productId) external {
        _requireCompanyOwner(productId);
        productCatalog.deactivateProduct(productId);
    }

    // ─── Cart ──────────────────────────────────────────────────────────────

    function addToCart(uint256 productId, uint256 quantity) external {
        ProductCatalog.Product memory p = productCatalog.getProduct(productId);
        if (!p.isActive) revert ProductInactive();
        if (p.stock < quantity) revert InsufficientStock();

        customerRegistry.registerOrGet(msg.sender);
        shoppingCart.addToCart(msg.sender, productId, quantity, p.price);
        emit CartUpdated(msg.sender);
    }

    function updateCartQuantity(uint256 productId, uint256 quantity) external {
        ProductCatalog.Product memory p = productCatalog.getProduct(productId);
        if (p.stock < quantity) revert InsufficientStock();
        shoppingCart.updateQuantity(msg.sender, productId, quantity);
        emit CartUpdated(msg.sender);
    }

    function removeFromCart(uint256 productId) external {
        shoppingCart.removeFromCart(msg.sender, productId);
        emit CartUpdated(msg.sender);
    }

    function calculateTotal() external view returns (uint256) {
        return shoppingCart.calculateTotal(msg.sender);
    }

    // ─── Invoice ───────────────────────────────────────────────────────────

    function createInvoice(uint256 companyId) external returns (uint256 invoiceId) {
        ShoppingCart.CartItem[] memory items = shoppingCart.getCart(msg.sender);
        if (items.length == 0) revert EmptyCart();

        InvoiceSystem.InvoiceItem[] memory invoiceItems = new InvoiceSystem.InvoiceItem[](items.length);
        uint256 total = 0;

        for (uint256 i = 0; i < items.length; i++) {
            ProductCatalog.Product memory p = productCatalog.getProduct(items[i].productId);
            if (p.companyId != companyId) revert MixedCompanies();

            uint256 lineTotal = items[i].quantity * items[i].unitPrice;
            invoiceItems[i] = InvoiceSystem.InvoiceItem({
                productId: items[i].productId,
                productName: p.name,
                quantity: items[i].quantity,
                unitPrice: items[i].unitPrice,
                totalPrice: lineTotal
            });
            total += lineTotal;
        }

        invoiceId = invoiceSystem.createInvoice(msg.sender, companyId, invoiceItems, total);
        shoppingCart.clearCart(msg.sender);

        emit InvoiceCreated(invoiceId, msg.sender, companyId);
    }

    // ─── Payment ───────────────────────────────────────────────────────────

    function processPayment(uint256 invoiceId) external {
        InvoiceSystem.Invoice memory inv = invoiceSystem.getInvoice(invoiceId);
        if (inv.isPaid) revert InvoiceAlreadyPaid();
        if (inv.customerAddress != msg.sender) revert NotInvoiceOwner();

        CompanyRegistry.Company memory company = companyRegistry.getCompany(inv.companyId);

        paymentGateway.processPayment(msg.sender, company.companyAddress, inv.totalAmount);
        invoiceSystem.markAsPaid(invoiceId, "");

        InvoiceSystem.InvoiceItem[] memory items = invoiceSystem.getInvoiceItems(invoiceId);
        for (uint256 i = 0; i < items.length; i++) {
            productCatalog.decreaseStock(items[i].productId, items[i].quantity);
        }

        customerRegistry.recordPurchase(msg.sender, inv.totalAmount);
        emit PaymentProcessed(invoiceId, inv.totalAmount);
    }

    function refund(uint256 invoiceId) external {
        InvoiceSystem.Invoice memory inv = invoiceSystem.getInvoice(invoiceId);
        CompanyRegistry.Company memory company = companyRegistry.getCompany(inv.companyId);
        if (msg.sender != company.companyAddress && msg.sender != owner) revert NotAuthorized();

        paymentGateway.refund(inv.customerAddress, company.companyAddress, inv.totalAmount);
        invoiceSystem.markAsRefunded(invoiceId);
        emit Refunded(invoiceId);
    }

    // ─── Views ─────────────────────────────────────────────────────────────

    function getCompany(uint256 companyId) external view returns (CompanyRegistry.Company memory) {
        return companyRegistry.getCompany(companyId);
    }

    function getCompanyIdByAddress(address companyAddress) external view returns (uint256) {
        return companyRegistry.getCompanyIdByAddress(companyAddress);
    }

    function getProduct(uint256 productId) external view returns (ProductCatalog.Product memory) {
        return productCatalog.getProduct(productId);
    }

    function getProductsByCompany(uint256 companyId) external view returns (uint256[] memory) {
        return productCatalog.getProductsByCompany(companyId);
    }

    function getCart() external view returns (ShoppingCart.CartItem[] memory) {
        return shoppingCart.getCart(msg.sender);
    }

    function getInvoice(uint256 invoiceId) external view returns (InvoiceSystem.Invoice memory) {
        return invoiceSystem.getInvoice(invoiceId);
    }

    function getInvoiceItems(uint256 invoiceId) external view returns (InvoiceSystem.InvoiceItem[] memory) {
        return invoiceSystem.getInvoiceItems(invoiceId);
    }

    function getCustomerInvoices(address customer) external view returns (uint256[] memory) {
        return invoiceSystem.getCustomerInvoices(customer);
    }

    function getCustomer(address customer) external view returns (CustomerRegistry.Customer memory) {
        return customerRegistry.getCustomer(customer);
    }

    // ─── Internal ──────────────────────────────────────────────────────────

    function _requireCompanyOwner(uint256 productId) internal view {
        uint256 companyId = productCatalog.getProductCompanyId(productId);
        CompanyRegistry.Company memory c = companyRegistry.getCompany(companyId);
        if (msg.sender != c.companyAddress && msg.sender != owner) revert NotAuthorized();
    }
}
