// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ShoppingCart} from "../src/ShoppingCart.sol";
import {EcommerceMain} from "../src/EcommerceMain.sol";
import {MockERC20} from "./helpers/MockERC20.sol";

contract ShoppingCartTest is Test {
    ShoppingCart cart;
    address customer = makeAddr("customer");
    uint256 constant PRICE = 5_000_000; // 5 EURT

    function setUp() public {
        cart = new ShoppingCart(address(this));
    }

    function test_AddToCart() public {
        cart.addToCart(customer, 1, 2, PRICE);
        ShoppingCart.CartItem[] memory items = cart.getCart(customer);
        assertEq(items.length, 1);
        assertEq(items[0].productId, 1);
        assertEq(items[0].quantity, 2);
        assertEq(items[0].unitPrice, PRICE);
    }

    function test_AddSameProductAccumulates() public {
        cart.addToCart(customer, 1, 2, PRICE);
        cart.addToCart(customer, 1, 3, PRICE);
        ShoppingCart.CartItem[] memory items = cart.getCart(customer);
        assertEq(items.length, 1);
        assertEq(items[0].quantity, 5);
    }

    function test_AddMultipleProducts() public {
        cart.addToCart(customer, 1, 1, PRICE);
        cart.addToCart(customer, 2, 2, PRICE);
        assertEq(cart.getCartLength(customer), 2);
    }

    function test_AddEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit ShoppingCart.ItemAdded(customer, 1, 2);
        cart.addToCart(customer, 1, 2, PRICE);
    }

    function test_UpdateQuantity() public {
        cart.addToCart(customer, 1, 2, PRICE);
        cart.updateQuantity(customer, 1, 10);
        assertEq(cart.getCart(customer)[0].quantity, 10);
    }

    function test_UpdateEmitsEvent() public {
        cart.addToCart(customer, 1, 2, PRICE);
        vm.expectEmit(true, true, false, true);
        emit ShoppingCart.ItemUpdated(customer, 1, 10);
        cart.updateQuantity(customer, 1, 10);
    }

    function test_RevertUpdateQuantityZero() public {
        cart.addToCart(customer, 1, 2, PRICE);
        vm.expectRevert(ShoppingCart.ZeroQuantity.selector);
        cart.updateQuantity(customer, 1, 0);
    }

    function test_RevertUpdateNotInCart() public {
        vm.expectRevert(ShoppingCart.ProductNotInCart.selector);
        cart.updateQuantity(customer, 999, 5);
    }

    function test_RemoveFromCart() public {
        cart.addToCart(customer, 1, 1, PRICE);
        cart.addToCart(customer, 2, 1, PRICE);
        cart.removeFromCart(customer, 1);
        ShoppingCart.CartItem[] memory items = cart.getCart(customer);
        assertEq(items.length, 1);
        assertEq(items[0].productId, 2);
    }

    function test_RemoveLastItem() public {
        cart.addToCart(customer, 1, 1, PRICE);
        cart.removeFromCart(customer, 1);
        assertEq(cart.getCartLength(customer), 0);
    }

    function test_RemoveSwapsWithLast() public {
        cart.addToCart(customer, 1, 1, PRICE);
        cart.addToCart(customer, 2, 1, PRICE);
        cart.addToCart(customer, 3, 1, PRICE);
        cart.removeFromCart(customer, 1); // removes first, swaps with productId=3
        ShoppingCart.CartItem[] memory items = cart.getCart(customer);
        assertEq(items.length, 2);
        // productId=3 should now be at index 0
        bool found2 = false;
        bool found3 = false;
        for (uint256 i = 0; i < items.length; i++) {
            if (items[i].productId == 3) found2 = true;
            if (items[i].productId == 2) found3 = true;
        }
        assertTrue(found2);
        assertTrue(found3);
    }

    function test_RevertRemoveNotInCart() public {
        vm.expectRevert(ShoppingCart.ProductNotInCart.selector);
        cart.removeFromCart(customer, 999);
    }

    function test_ClearCart() public {
        cart.addToCart(customer, 1, 1, PRICE);
        cart.addToCart(customer, 2, 2, PRICE);
        cart.clearCart(customer);
        assertEq(cart.getCartLength(customer), 0);
    }

    function test_ClearCartEmitsEvent() public {
        cart.addToCart(customer, 1, 1, PRICE);
        vm.expectEmit(true, false, false, false);
        emit ShoppingCart.CartCleared(customer);
        cart.clearCart(customer);
    }

    function test_CalculateTotal() public {
        cart.addToCart(customer, 1, 2, 10_000_000); // 2 * 10 EURT = 20
        cart.addToCart(customer, 2, 3, 5_000_000);  // 3 * 5 EURT  = 15
        assertEq(cart.calculateTotal(customer), 35_000_000);
    }

    function test_CalculateTotalEmptyCart() public {
        assertEq(cart.calculateTotal(customer), 0);
    }

    function test_RevertAddZeroQuantity() public {
        vm.expectRevert(ShoppingCart.ZeroQuantity.selector);
        cart.addToCart(customer, 1, 0, PRICE);
    }

    function test_RevertUnauthorized() public {
        vm.prank(makeAddr("other"));
        vm.expectRevert(ShoppingCart.Unauthorized.selector);
        cart.addToCart(customer, 1, 1, PRICE);
    }

    function test_IndependentCartsPerCustomer() public {
        address customer2 = makeAddr("customer2");
        cart.addToCart(customer, 1, 5, PRICE);
        cart.addToCart(customer2, 1, 10, PRICE);
        assertEq(cart.getCart(customer)[0].quantity, 5);
        assertEq(cart.getCart(customer2)[0].quantity, 10);
    }
    
    // La validación de stock vive en EcommerceMain (ver ShoppingCartViaMainTest más abajo).
    // ShoppingCart es un módulo de almacenamiento; su única restricción de cantidad es quantity > 0.
    function test_RevertWhen_AddToCartZeroQuantity() public {
        vm.expectRevert(ShoppingCart.ZeroQuantity.selector);
        cart.addToCart(customer, 101, 0, PRICE);
    }
}

/// Tests de carrito que pasan por EcommerceMain para validar stock y estado del producto
contract ShoppingCartViaMainTest is Test {
    EcommerceMain ecommerce;

    address owner = makeAddr("owner");
    address companyWallet = makeAddr("company");
    address customer = makeAddr("customer");

    uint256 companyId;
    uint256 productId;
    uint256 constant STOCK = 10;
    uint256 constant PRICE = 5_000_000; // 5 EURT

    function setUp() public {
        MockERC20 token = new MockERC20();
        vm.prank(owner);
        ecommerce = new EcommerceMain(address(token));
        vm.prank(owner);
        ecommerce.initialize();

        vm.prank(owner);
        companyId = ecommerce.registerCompany(companyWallet, "ACME", "desc", "TAX1");

        vm.prank(companyWallet);
        productId = ecommerce.addProduct(companyId, "Widget", "desc", PRICE, STOCK, "");
    }

    function test_AddToCartWithinStock() public {
        vm.prank(customer);
        ecommerce.addToCart(productId, STOCK);
        assertEq(ecommerce.shoppingCart().getCartLength(customer), 1);
        assertEq(ecommerce.shoppingCart().getCart(customer)[0].quantity, STOCK);
    }

    function test_RevertAddToCart_InsufficientStock() public {
        vm.prank(customer);
        vm.expectRevert(EcommerceMain.InsufficientStock.selector);
        ecommerce.addToCart(productId, STOCK + 1);
    }

    function test_RevertAddToCart_ProductNotFound() public {
        vm.prank(customer);
        vm.expectRevert(); // ProductCatalog.ProductNotFound
        ecommerce.addToCart(999, 1);
    }

    function test_RevertAddToCart_InactiveProduct() public {
        vm.prank(companyWallet);
        ecommerce.deactivateProduct(productId);

        vm.prank(customer);
        vm.expectRevert(EcommerceMain.ProductInactive.selector);
        ecommerce.addToCart(productId, 1);
    }

    function test_UpdateCartQuantity_ExceedsStock() public {
        vm.prank(customer);
        ecommerce.addToCart(productId, 1);

        vm.prank(customer);
        vm.expectRevert(EcommerceMain.InsufficientStock.selector);
        ecommerce.updateCartQuantity(productId, STOCK + 1);
    }

    function test_UpdateCartQuantity_WithinStock() public {
        vm.prank(customer);
        ecommerce.addToCart(productId, 1);

        vm.prank(customer);
        ecommerce.updateCartQuantity(productId, STOCK);

        assertEq(ecommerce.shoppingCart().getCart(customer)[0].quantity, STOCK);
    }

    function test_StockNotDeductedUntilPayment() public {
        vm.prank(customer);
        ecommerce.addToCart(productId, STOCK);

        // El stock sigue igual después de añadir al carrito — solo se descuenta al pagar
        assertEq(ecommerce.getProduct(productId).stock, STOCK);
    }
}
