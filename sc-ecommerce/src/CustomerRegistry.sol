// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CustomerRegistry {
    struct Customer {
        address customerAddress;
        uint256 totalPurchases;
        uint256 totalSpent;
        uint256 registrationDate;
        uint256 lastPurchaseDate;
        bool isActive;
    }

    mapping(address => Customer) private _customers;
    address[] private _customerAddresses;

    address public authorized;

    event CustomerRegistered(address indexed customerAddress);
    event PurchaseRecorded(address indexed customerAddress, uint256 totalPurchases, uint256 totalSpent);

    error Unauthorized();
    error ZeroAddress();

    modifier onlyAuthorized() {
        if (msg.sender != authorized) revert Unauthorized();
        _;
    }

    constructor(address _authorized) {
        if (_authorized == address(0)) revert ZeroAddress();
        authorized = _authorized;
    }

    function registerOrGet(address customerAddress) external onlyAuthorized returns (bool isNew) {
        if (customerAddress == address(0)) revert ZeroAddress();
        if (_customers[customerAddress].registrationDate != 0) return false;

        _customers[customerAddress] = Customer({
            customerAddress: customerAddress,
            totalPurchases: 0,
            totalSpent: 0,
            registrationDate: block.timestamp,
            lastPurchaseDate: 0,
            isActive: true
        });
        _customerAddresses.push(customerAddress);
        emit CustomerRegistered(customerAddress);
        return true;
    }

    function recordPurchase(address customerAddress, uint256 amount) external onlyAuthorized {
        Customer storage c = _customers[customerAddress];
        if (c.registrationDate == 0) {
            c.customerAddress = customerAddress;
            c.registrationDate = block.timestamp;
            c.isActive = true;
            _customerAddresses.push(customerAddress);
            emit CustomerRegistered(customerAddress);
        }
        c.totalPurchases += 1;
        c.totalSpent += amount;
        c.lastPurchaseDate = block.timestamp;
        emit PurchaseRecorded(customerAddress, c.totalPurchases, c.totalSpent);
    }

    function getCustomer(address customerAddress) external view returns (Customer memory) {
        return _customers[customerAddress];
    }

    function isRegistered(address customerAddress) external view returns (bool) {
        return _customers[customerAddress].registrationDate != 0;
    }

    function getAllCustomers() external view returns (address[] memory) {
        return _customerAddresses;
    }
}
