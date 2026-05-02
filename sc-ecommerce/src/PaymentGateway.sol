// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PaymentGateway {
    IERC20 public euroToken;
    address public authorized;

    event PaymentProcessed(address indexed from, address indexed to, uint256 amount);
    event Refunded(address indexed to, address indexed from, uint256 amount);

    error Unauthorized();
    error ZeroAddress();
    error TransferFailed();
    error InsufficientAllowance();
    error InsufficientBalance();

    modifier onlyAuthorized() {
        if (msg.sender != authorized) revert Unauthorized();
        _;
    }

    constructor(address _authorized, address _euroToken) {
        if (_authorized == address(0) || _euroToken == address(0)) revert ZeroAddress();
        authorized = _authorized;
        euroToken = IERC20(_euroToken);
    }

    /// @dev Customer must have approved this contract before calling
    function processPayment(address customer, address companyAddress, uint256 amount) external onlyAuthorized {
        if (euroToken.allowance(customer, address(this)) < amount) revert InsufficientAllowance();
        if (euroToken.balanceOf(customer) < amount) revert InsufficientBalance();
        bool success = euroToken.transferFrom(customer, companyAddress, amount);
        if (!success) revert TransferFailed();
        emit PaymentProcessed(customer, companyAddress, amount);
    }

    /// @dev Company must have approved this contract before calling refund
    function refund(address customer, address companyAddress, uint256 amount) external onlyAuthorized {
        if (euroToken.allowance(companyAddress, address(this)) < amount) revert InsufficientAllowance();
        if (euroToken.balanceOf(companyAddress) < amount) revert InsufficientBalance();
        bool success = euroToken.transferFrom(companyAddress, customer, amount);
        if (!success) revert TransferFailed();
        emit Refunded(customer, companyAddress, amount);
    }
}
