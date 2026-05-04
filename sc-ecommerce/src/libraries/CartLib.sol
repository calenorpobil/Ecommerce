// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library CartLib {
    struct CartItem {
        uint256 productId;
        uint256 quantity;
        uint256 unitPrice;
    }

    struct Data {
        mapping(address => CartItem[]) carts;
        mapping(address => mapping(uint256 => uint256)) cartIndex; // customer => productId => index+1
    }

    error ProductNotInCart();
    error ZeroQuantity();

    function add(
        Data storage self,
        address customer,
        uint256 productId,
        uint256 quantity,
        uint256 unitPrice
    ) internal {
        if (quantity == 0) revert ZeroQuantity();

        uint256 idx = self.cartIndex[customer][productId];
        if (idx != 0) {
            CartItem storage item = self.carts[customer][idx - 1];
            item.quantity += quantity;
            item.unitPrice = unitPrice;
        } else {
            self.carts[customer].push(CartItem({productId: productId, quantity: quantity, unitPrice: unitPrice}));
            self.cartIndex[customer][productId] = self.carts[customer].length;
        }
    }

    function updateQuantity(Data storage self, address customer, uint256 productId, uint256 quantity) internal {
        uint256 idx = self.cartIndex[customer][productId];
        if (idx == 0) revert ProductNotInCart();
        if (quantity == 0) revert ZeroQuantity();
        self.carts[customer][idx - 1].quantity = quantity;
    }

    function remove(Data storage self, address customer, uint256 productId) internal {
        uint256 idx = self.cartIndex[customer][productId];
        if (idx == 0) revert ProductNotInCart();

        uint256 lastIdx = self.carts[customer].length - 1;
        if (idx - 1 != lastIdx) {
            CartItem storage last = self.carts[customer][lastIdx];
            self.carts[customer][idx - 1] = last;
            self.cartIndex[customer][last.productId] = idx;
        }
        self.carts[customer].pop();
        delete self.cartIndex[customer][productId];
    }

    function clear(Data storage self, address customer) internal {
        CartItem[] storage cart = self.carts[customer];
        for (uint256 i = 0; i < cart.length; i++) {
            delete self.cartIndex[customer][cart[i].productId];
        }
        delete self.carts[customer];
    }

    function calculateTotal(Data storage self, address customer) internal view returns (uint256 total) {
        CartItem[] storage cart = self.carts[customer];
        for (uint256 i = 0; i < cart.length; i++) {
            total += cart[i].quantity * cart[i].unitPrice;
        }
    }

    function getCart(Data storage self, address customer) internal view returns (CartItem[] memory) {
        return self.carts[customer];
    }
}
