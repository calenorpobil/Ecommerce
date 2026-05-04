// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library PaymentLib {
    error TransferFailed();
    error InsufficientAllowance();
    error InsufficientBalance();

    function processPayment(address euroToken, address customer, address company, uint256 amount) internal {
        IERC20 token = IERC20(euroToken);
        if (token.allowance(customer, address(this)) < amount) revert InsufficientAllowance();
        if (token.balanceOf(customer) < amount) revert InsufficientBalance();
        bool success = token.transferFrom(customer, company, amount);
        if (!success) revert TransferFailed();
    }

    function refund(address euroToken, address customer, address company, uint256 amount) internal {
        IERC20 token = IERC20(euroToken);
        if (token.allowance(company, address(this)) < amount) revert InsufficientAllowance();
        if (token.balanceOf(company) < amount) revert InsufficientBalance();
        bool success = token.transferFrom(company, customer, amount);
        if (!success) revert TransferFailed();
    }
}
