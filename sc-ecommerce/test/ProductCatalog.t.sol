// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ProductCatalog} from "../src/ProductCatalog.sol";

contract ProductCatalogTest is Test {
    ProductCatalog catalog;
    uint256 constant COMPANY_ID = 1;
    uint256 constant PRICE = 10_000_000; // 10 EURT (6 decimales)

    function setUp() public {
        catalog = new ProductCatalog(address(this));
    }

    function test_AddProduct() public {
        uint256 id = catalog.addProduct(COMPANY_ID, "Widget", "A widget", PRICE, 100, "QmHash");
        assertEq(id, 1);
        ProductCatalog.Product memory p = catalog.getProduct(1);
        assertEq(p.companyId, COMPANY_ID);
        assertEq(p.name, "Widget");
        assertEq(p.price, PRICE);
        assertEq(p.stock, 100);
        assertTrue(p.isActive);
        assertEq(p.createdAt, block.timestamp);
    }

    function test_AddProductEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit ProductCatalog.ProductAdded(1, COMPANY_ID, PRICE);
        catalog.addProduct(COMPANY_ID, "Widget", "desc", PRICE, 10, "");
    }

    function test_RevertZeroPrice() public {
        vm.expectRevert(ProductCatalog.ZeroPrice.selector);
        catalog.addProduct(COMPANY_ID, "Widget", "desc", 0, 10, "");
    }

    function test_RevertEmptyName() public {
        vm.expectRevert(ProductCatalog.EmptyName.selector);
        catalog.addProduct(COMPANY_ID, "", "desc", PRICE, 10, "");
    }

    function test_UpdateProduct() public {
        catalog.addProduct(COMPANY_ID, "Widget", "Old", PRICE, 10, "");
        catalog.updateProduct(1, "Widget v2", "New", PRICE * 2, "QmNew");
        ProductCatalog.Product memory p = catalog.getProduct(1);
        assertEq(p.name, "Widget v2");
        assertEq(p.description, "New");
        assertEq(p.price, PRICE * 2);
        assertEq(p.ipfsImageHash, "QmNew");
    }

    function test_RevertUpdateNotFound() public {
        vm.expectRevert(ProductCatalog.ProductNotFound.selector);
        catalog.updateProduct(999, "X", "desc", PRICE, "");
    }

    function test_UpdateStock() public {
        catalog.addProduct(COMPANY_ID, "Widget", "desc", PRICE, 10, "");
        catalog.updateStock(1, 50);
        assertEq(catalog.getProduct(1).stock, 50);
    }

    function test_DecreaseStock() public {
        catalog.addProduct(COMPANY_ID, "Widget", "desc", PRICE, 10, "");
        catalog.decreaseStock(1, 3);
        assertEq(catalog.getProduct(1).stock, 7);
    }

    function test_RevertDecreaseStockInsufficient() public {
        catalog.addProduct(COMPANY_ID, "Widget", "desc", PRICE, 5, "");
        vm.expectRevert(ProductCatalog.InsufficientStock.selector);
        catalog.decreaseStock(1, 6);
    }

    function test_DeactivateProduct() public {
        catalog.addProduct(COMPANY_ID, "Widget", "desc", PRICE, 10, "");
        catalog.deactivateProduct(1);
        assertFalse(catalog.getProduct(1).isActive);
    }

    function test_GetProductsByCompany() public {
        catalog.addProduct(1, "A", "desc", PRICE, 10, "");
        catalog.addProduct(1, "B", "desc", PRICE, 10, "");
        catalog.addProduct(2, "C", "desc", PRICE, 10, "");
        assertEq(catalog.getProductsByCompany(1).length, 2);
        assertEq(catalog.getProductsByCompany(2).length, 1);
    }

    function test_GetProductCompanyId() public {
        catalog.addProduct(COMPANY_ID, "Widget", "desc", PRICE, 10, "");
        assertEq(catalog.getProductCompanyId(1), COMPANY_ID);
    }

    function test_RevertUnauthorized() public {
        vm.prank(makeAddr("other"));
        vm.expectRevert(ProductCatalog.Unauthorized.selector);
        catalog.addProduct(COMPANY_ID, "Widget", "desc", PRICE, 10, "");
    }

    function test_RevertProductNotFound() public {
        vm.expectRevert(ProductCatalog.ProductNotFound.selector);
        catalog.getProduct(999);
    }

    function testFuzz_AddProductPrice(uint256 price) public {
        vm.assume(price > 0 && price <= type(uint128).max);
        uint256 id = catalog.addProduct(COMPANY_ID, "Widget", "desc", price, 10, "");
        assertEq(catalog.getProduct(id).price, price);
    }
}
