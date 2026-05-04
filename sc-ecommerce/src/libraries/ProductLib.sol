// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library ProductLib {
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

    struct Data {
        uint256 nextId;
        uint256[] ids;
        mapping(uint256 => Product) products;
        mapping(uint256 => uint256[]) companyProducts;
    }

    error ProductNotFound();
    error InsufficientStock();
    error EmptyName();
    error ZeroPrice();

    function add(
        Data storage self,
        uint256 companyId,
        string calldata name,
        string calldata description,
        uint256 price,
        uint256 stock,
        string calldata ipfsImageHash
    ) internal returns (uint256) {
        if (bytes(name).length == 0) revert EmptyName();
        if (price == 0) revert ZeroPrice();

        uint256 id = ++self.nextId;
        self.products[id] = Product({
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
        self.ids.push(id);
        self.companyProducts[companyId].push(id);
        return id;
    }

    function update(
        Data storage self,
        uint256 productId,
        string calldata name,
        string calldata description,
        uint256 price,
        string calldata ipfsImageHash
    ) internal {
        Product storage p = self.products[productId];
        if (p.productId == 0) revert ProductNotFound();
        if (bytes(name).length == 0) revert EmptyName();
        if (price == 0) revert ZeroPrice();

        p.name = name;
        p.description = description;
        p.price = price;
        p.ipfsImageHash = ipfsImageHash;
    }

    function setStock(Data storage self, uint256 productId, uint256 newStock) internal {
        if (self.products[productId].productId == 0) revert ProductNotFound();
        self.products[productId].stock = newStock;
    }

    function decreaseStock(Data storage self, uint256 productId, uint256 amount) internal {
        Product storage p = self.products[productId];
        if (p.productId == 0) revert ProductNotFound();
        if (p.stock < amount) revert InsufficientStock();
        p.stock -= amount;
    }

    function deactivate(Data storage self, uint256 productId) internal {
        if (self.products[productId].productId == 0) revert ProductNotFound();
        self.products[productId].isActive = false;
    }

    function get(Data storage self, uint256 productId) internal view returns (Product memory) {
        if (self.products[productId].productId == 0) revert ProductNotFound();
        return self.products[productId];
    }

    function getByCompany(Data storage self, uint256 companyId) internal view returns (uint256[] memory) {
        return self.companyProducts[companyId];
    }
}
