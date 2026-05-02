// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {EcommerceMain} from "../src/EcommerceMain.sol";
import {CompanyRegistry} from "../src/CompanyRegistry.sol";
import {ProductCatalog} from "../src/ProductCatalog.sol";
import {InvoiceSystem} from "../src/InvoiceSystem.sol";
import {CustomerRegistry} from "../src/CustomerRegistry.sol";
import {PaymentGateway} from "../src/PaymentGateway.sol";
import {MockERC20} from "./helpers/MockERC20.sol";

/// @dev Flujo completo: registro → producto → carrito → invoice → pago → refund
contract IntegrationTest is Test {
    EcommerceMain ecommerce;
    MockERC20 euroToken;

    address owner = makeAddr("owner");
    address companyWallet = makeAddr("company");
    address customer = makeAddr("customer");

    uint256 companyId;
    uint256 productId;
    uint256 constant PRODUCT_PRICE = 1000_000_000; // 1000 EURT
    uint256 constant STOCK = 50;

    function setUp() public {
        euroToken = new MockERC20();

        vm.prank(owner);
        ecommerce = new EcommerceMain(address(euroToken));
        vm.prank(owner);
        ecommerce.initialize();

        vm.prank(owner);
        companyId = ecommerce.registerCompany(companyWallet, "TechCorp", "Tech products", "TC-001");

        vm.prank(companyWallet);
        productId = ecommerce.addProduct(companyId, "Laptop", "A laptop", PRODUCT_PRICE, STOCK, "QmHash");

        euroToken.mint(customer, 10_000 * 1_000_000); // 10 000 EURT
    }

    // ─── Flujo completo: cart → invoice → pago ─────────────────────────────

    function test_FullPurchaseFlow() public {
        // 1. Añadir al carrito
        vm.prank(customer);
        ecommerce.addToCart(productId, 2);

        // 2. Verificar total
        vm.prank(customer);
        assertEq(ecommerce.calculateTotal(), 2 * PRODUCT_PRICE);

        // 3. Crear invoice
        vm.prank(customer);
        uint256 invoiceId = ecommerce.createInvoice(companyId);

        InvoiceSystem.Invoice memory inv = ecommerce.getInvoice(invoiceId);
        assertEq(inv.totalAmount, 2 * PRODUCT_PRICE);
        assertFalse(inv.isPaid);

        // El carrito debe quedar vacío tras crear la invoice
        vm.prank(customer);
        assertEq(ecommerce.getCart().length, 0);

        // 4. Aprobar gateway y pagar
        address pgw = address(ecommerce.paymentGateway());
        vm.prank(customer);
        euroToken.approve(pgw, 2 * PRODUCT_PRICE);

        vm.prank(customer);
        ecommerce.processPayment(invoiceId);

        // 5. Verificar invoice pagada
        assertTrue(ecommerce.getInvoice(invoiceId).isPaid);

        // 6. Verificar balances
        assertEq(euroToken.balanceOf(companyWallet), 2 * PRODUCT_PRICE);
        assertEq(euroToken.balanceOf(customer), 10_000 * 1_000_000 - 2 * PRODUCT_PRICE);

        // 7. Verificar stock descontado
        assertEq(ecommerce.getProduct(productId).stock, STOCK - 2);

        // 8. Verificar estadísticas del cliente
        CustomerRegistry.Customer memory c = ecommerce.getCustomer(customer);
        assertEq(c.totalPurchases, 1);
        assertEq(c.totalSpent, 2 * PRODUCT_PRICE);
    }

    // ─── Refund flow ───────────────────────────────────────────────────────

    function test_RefundFlow() public {
        vm.prank(customer);
        ecommerce.addToCart(productId, 1);
        vm.prank(customer);
        uint256 invoiceId = ecommerce.createInvoice(companyId);

        address pgw = address(ecommerce.paymentGateway());
        vm.prank(customer);
        euroToken.approve(pgw, PRODUCT_PRICE);
        vm.prank(customer);
        ecommerce.processPayment(invoiceId);

        // Empresa aprueba el gateway para el reembolso
        vm.prank(companyWallet);
        euroToken.approve(pgw, PRODUCT_PRICE);

        vm.prank(companyWallet);
        ecommerce.refund(invoiceId);

        assertTrue(ecommerce.getInvoice(invoiceId).isRefunded);
        // El cliente recupera su saldo completo
        assertEq(euroToken.balanceOf(customer), 10_000 * 1_000_000);
    }

    // ─── Control de acceso ─────────────────────────────────────────────────

    function test_OnlyCompanyCanAddProducts() public {
        address attacker = makeAddr("attacker");
        vm.prank(attacker);
        vm.expectRevert(EcommerceMain.NotAuthorized.selector);
        ecommerce.addProduct(companyId, "Fake", "desc", 100, 10, "");
    }

    function test_OwnerCanAddProducts() public {
        vm.prank(owner);
        uint256 newId = ecommerce.addProduct(companyId, "OwnerProduct", "desc", 1_000_000, 5, "");
        assertGt(newId, 0);
    }

    function test_OnlyCompanyOrOwnerCanDeactivate() public {
        address attacker = makeAddr("attacker");
        vm.prank(attacker);
        vm.expectRevert(EcommerceMain.NotAuthorized.selector);
        ecommerce.deactivateCompany(companyId);
    }

    function test_CompanyCanDeactivateItself() public {
        vm.prank(companyWallet);
        ecommerce.deactivateCompany(companyId);
        assertFalse(ecommerce.getCompany(companyId).isActive);
    }

    // ─── Validaciones de negocio ───────────────────────────────────────────

    function test_RevertInsufficientStock() public {
        vm.prank(customer);
        vm.expectRevert(EcommerceMain.InsufficientStock.selector);
        ecommerce.addToCart(productId, STOCK + 1);
    }

    function test_RevertAddInactiveProduct() public {
        vm.prank(companyWallet);
        ecommerce.deactivateProduct(productId);

        vm.prank(customer);
        vm.expectRevert(EcommerceMain.ProductInactive.selector);
        ecommerce.addToCart(productId, 1);
    }

    function test_RevertEmptyCart() public {
        vm.prank(customer);
        vm.expectRevert(EcommerceMain.EmptyCart.selector);
        ecommerce.createInvoice(companyId);
    }

    function test_RevertMixedCompanies() public {
        address company2Wallet = makeAddr("company2");
        vm.prank(owner);
        uint256 companyId2 = ecommerce.registerCompany(company2Wallet, "OtherCorp", "desc", "OC-001");
        vm.prank(company2Wallet);
        uint256 productId2 = ecommerce.addProduct(companyId2, "Phone", "desc", 500_000_000, 10, "");

        vm.prank(customer);
        ecommerce.addToCart(productId, 1);
        vm.prank(customer);
        ecommerce.addToCart(productId2, 1);

        vm.prank(customer);
        vm.expectRevert(EcommerceMain.MixedCompanies.selector);
        ecommerce.createInvoice(companyId);
    }

    function test_RevertPaymentWithoutApproval() public {
        vm.prank(customer);
        ecommerce.addToCart(productId, 1);
        vm.prank(customer);
        uint256 invoiceId = ecommerce.createInvoice(companyId);

        vm.prank(customer);
        vm.expectRevert(PaymentGateway.InsufficientAllowance.selector);
        ecommerce.processPayment(invoiceId);
    }

    function test_RevertDoublePayment() public {
        vm.prank(customer);
        ecommerce.addToCart(productId, 1);
        vm.prank(customer);
        uint256 invoiceId = ecommerce.createInvoice(companyId);

        address pgw = address(ecommerce.paymentGateway());
        vm.prank(customer);
        euroToken.approve(pgw, PRODUCT_PRICE);
        vm.prank(customer);
        ecommerce.processPayment(invoiceId);

        vm.prank(customer);
        vm.expectRevert(EcommerceMain.InvoiceAlreadyPaid.selector);
        ecommerce.processPayment(invoiceId);
    }

    function test_RevertPaymentByWrongCustomer() public {
        vm.prank(customer);
        ecommerce.addToCart(productId, 1);
        vm.prank(customer);
        uint256 invoiceId = ecommerce.createInvoice(companyId);

        address other = makeAddr("other");
        euroToken.mint(other, PRODUCT_PRICE);
        address pgw = address(ecommerce.paymentGateway());
        vm.prank(other);
        euroToken.approve(pgw, PRODUCT_PRICE);

        vm.prank(other);
        vm.expectRevert(EcommerceMain.NotInvoiceOwner.selector);
        ecommerce.processPayment(invoiceId);
    }

    // ─── Auto-registro de clientes ─────────────────────────────────────────

    function test_CustomerAutoRegistersOnAddToCart() public {
        assertFalse(ecommerce.customerRegistry().isRegistered(customer));
        vm.prank(customer);
        ecommerce.addToCart(productId, 1);
        assertTrue(ecommerce.customerRegistry().isRegistered(customer));
    }

    // ─── Multiple purchases ────────────────────────────────────────────────

    function test_MultiplePurchasesAccumulateStats() public {
        address pgw = address(ecommerce.paymentGateway());

        for (uint256 i = 0; i < 3; i++) {
            vm.prank(customer);
            ecommerce.addToCart(productId, 1);
            vm.prank(customer);
            uint256 invoiceId = ecommerce.createInvoice(companyId);
            vm.prank(customer);
            euroToken.approve(pgw, PRODUCT_PRICE);
            vm.prank(customer);
            ecommerce.processPayment(invoiceId);
        }

        CustomerRegistry.Customer memory c = ecommerce.getCustomer(customer);
        assertEq(c.totalPurchases, 3);
        assertEq(c.totalSpent, 3 * PRODUCT_PRICE);
        assertEq(ecommerce.getProduct(productId).stock, STOCK - 3);
    }
}
