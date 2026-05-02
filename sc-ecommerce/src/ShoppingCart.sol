// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ShoppingCart {
    struct CartItem {
        uint256 productId;
        uint256 quantity;
        uint256 unitPrice;
    }

    // customer => items array
    mapping(address => CartItem[]) private _carts;
    // customer => productId => index+1 (0 means not in cart)
    mapping(address => mapping(uint256 => uint256)) private _cartIndex;

    address public authorized;

    event ItemAdded(address indexed customer, uint256 indexed productId, uint256 quantity);
    event ItemUpdated(address indexed customer, uint256 indexed productId, uint256 quantity);
    event ItemRemoved(address indexed customer, uint256 indexed productId);
    event CartCleared(address indexed customer);

    error Unauthorized();
    error ZeroAddress();
    error ProductNotInCart();
    error ZeroQuantity();

    modifier onlyAuthorized() {
        if (msg.sender != authorized) revert Unauthorized();
        _;
    }

    constructor(address _authorized) {
        if (_authorized == address(0)) revert ZeroAddress();
        authorized = _authorized;
    }

    function addToCart(address customer, uint256 productId, uint256 quantity, uint256 unitPrice)
        external
        onlyAuthorized
    {
        if (quantity == 0) revert ZeroQuantity();

        uint256 idx = _cartIndex[customer][productId];
        if (idx != 0) {
            CartItem storage item = _carts[customer][idx - 1];
            item.quantity += quantity;
            item.unitPrice = unitPrice;
            emit ItemUpdated(customer, productId, item.quantity);
        } else {
            _carts[customer].push(CartItem({productId: productId, quantity: quantity, unitPrice: unitPrice}));
            _cartIndex[customer][productId] = _carts[customer].length; // length = new index + 1
            emit ItemAdded(customer, productId, quantity);
        }
    }

    function updateQuantity(address customer, uint256 productId, uint256 quantity) external onlyAuthorized {
        uint256 idx = _cartIndex[customer][productId];
        if (idx == 0) revert ProductNotInCart();
        if (quantity == 0) revert ZeroQuantity();

        _carts[customer][idx - 1].quantity = quantity;
        emit ItemUpdated(customer, productId, quantity);
    }

    function removeFromCart(address customer, uint256 productId) external onlyAuthorized {
        uint256 idx = _cartIndex[customer][productId];
        if (idx == 0) revert ProductNotInCart();

        uint256 lastIdx = _carts[customer].length - 1;
        if (idx - 1 != lastIdx) {
            // swap with last to avoid gaps
            CartItem storage last = _carts[customer][lastIdx];
            _carts[customer][idx - 1] = last;
            _cartIndex[customer][last.productId] = idx;
        }
        _carts[customer].pop();
        delete _cartIndex[customer][productId];
        emit ItemRemoved(customer, productId);
    }

    function clearCart(address customer) external onlyAuthorized {
        CartItem[] storage cart = _carts[customer];
        for (uint256 i = 0; i < cart.length; i++) {
            delete _cartIndex[customer][cart[i].productId];
        }
        delete _carts[customer];
        emit CartCleared(customer);
    }

    function calculateTotal(address customer) external view returns (uint256 total) {
        CartItem[] storage cart = _carts[customer];
        for (uint256 i = 0; i < cart.length; i++) {
            total += cart[i].quantity * cart[i].unitPrice;
        }
    }

    function getCart(address customer) external view returns (CartItem[] memory) {
        return _carts[customer];
    }

    function getCartLength(address customer) external view returns (uint256) {
        return _carts[customer].length;
    }
}
