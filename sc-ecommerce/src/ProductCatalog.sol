// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ProductCatalog {
    struct Product {
        uint256 productId;
        uint256 companyId;
        string name;
        string description;
        uint256 price;
        uint256 stock;
        string ipfsImageHash;
        bool isActive;
        uint256 createdAt;
    }

    uint256 private _nextId = 1;
    uint256[] private _ids;
    mapping(uint256 => Product) private _products;
    mapping(uint256 => uint256[]) private _companyProducts;

    address public authorized;

    event ProductAdded(uint256 indexed productId, uint256 indexed companyId, uint256 price);
    event ProductUpdated(uint256 indexed productId);
    event StockUpdated(uint256 indexed productId, uint256 newStock);
    event ProductDeactivated(uint256 indexed productId);

    error Unauthorized();
    error ProductNotFound();
    error InsufficientStock();
    error ZeroAddress();
    error EmptyName();
    error ZeroPrice();

    modifier onlyAuthorized() {
        if (msg.sender != authorized) revert Unauthorized();
        _;
    }

    constructor(address _authorized) {
        if (_authorized == address(0)) revert ZeroAddress();
        authorized = _authorized;
    }

    function addProduct(
        uint256 companyId,
        string calldata name,
        string calldata description,
        uint256 price,
        uint256 stock,
        string calldata ipfsImageHash
    ) external onlyAuthorized returns (uint256) {
        if (bytes(name).length == 0) revert EmptyName();
        if (price == 0) revert ZeroPrice();

        uint256 id = _nextId++;
        _products[id] = Product({
            productId: id,
            companyId: companyId,
            name: name,
            description: description,
            price: price,
            stock: stock,
            ipfsImageHash: ipfsImageHash,
            isActive: true,
            createdAt: block.timestamp
        });
        _ids.push(id);
        _companyProducts[companyId].push(id);

        emit ProductAdded(id, companyId, price);
        return id;
    }

    function updateProduct(
        uint256 productId,
        string calldata name,
        string calldata description,
        uint256 price,
        string calldata ipfsImageHash
    ) external onlyAuthorized {
        Product storage p = _products[productId];
        if (p.productId == 0) revert ProductNotFound();
        if (bytes(name).length == 0) revert EmptyName();
        if (price == 0) revert ZeroPrice();

        p.name = name;
        p.description = description;
        p.price = price;
        p.ipfsImageHash = ipfsImageHash;

        emit ProductUpdated(productId);
    }

    function updateStock(uint256 productId, uint256 newStock) external onlyAuthorized {
        if (_products[productId].productId == 0) revert ProductNotFound();
        _products[productId].stock = newStock;
        emit StockUpdated(productId, newStock);
    }

    function decreaseStock(uint256 productId, uint256 amount) external onlyAuthorized {
        Product storage p = _products[productId];
        if (p.productId == 0) revert ProductNotFound();
        if (p.stock < amount) revert InsufficientStock();
        p.stock -= amount;
        emit StockUpdated(productId, p.stock);
    }

    function deactivateProduct(uint256 productId) external onlyAuthorized {
        if (_products[productId].productId == 0) revert ProductNotFound();
        _products[productId].isActive = false;
        emit ProductDeactivated(productId);
    }

    function getProduct(uint256 productId) external view returns (Product memory) {
        if (_products[productId].productId == 0) revert ProductNotFound();
        return _products[productId];
    }

    function getProductsByCompany(uint256 companyId) external view returns (uint256[] memory) {
        return _companyProducts[companyId];
    }

    function getProductCompanyId(uint256 productId) external view returns (uint256) {
        if (_products[productId].productId == 0) revert ProductNotFound();
        return _products[productId].companyId;
    }
}
