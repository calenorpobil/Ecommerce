// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library CustomerLib {
    struct Customer {
        address customerAddress;
        uint256 totalPurchases;
        uint256 totalSpent;
        uint256 registrationDate;
        uint256 lastPurchaseDate;
        bool isActive;
    }

    struct Data {
        mapping(address => Customer) customers;
        address[] addresses;
    }

    error ZeroAddress();

    function registerOrGet(Data storage self, address customerAddress) internal returns (bool isNew) {
        if (customerAddress == address(0)) revert ZeroAddress();
        if (self.customers[customerAddress].registrationDate != 0) return false;

        self.customers[customerAddress] = Customer({
            customerAddress: customerAddress,
            totalPurchases: 0,
            totalSpent: 0,
            registrationDate: block.timestamp,
            lastPurchaseDate: 0,
            isActive: true
        });
        self.addresses.push(customerAddress);
        return true;
    }

    function recordPurchase(Data storage self, address customerAddress, uint256 amount) internal {
        Customer storage c = self.customers[customerAddress];
        if (c.registrationDate == 0) {
            c.customerAddress = customerAddress;
            c.registrationDate = block.timestamp;
            c.isActive = true;
            self.addresses.push(customerAddress);
        }
        c.totalPurchases += 1;
        c.totalSpent += amount;
        c.lastPurchaseDate = block.timestamp;
    }

    function get(Data storage self, address customerAddress) internal view returns (Customer memory) {
        return self.customers[customerAddress];
    }
}
