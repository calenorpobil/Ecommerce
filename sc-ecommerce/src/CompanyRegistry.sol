// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CompanyRegistry {
    struct Company {
        uint256 companyId;
        address companyAddress;
        string name;
        string description;
        string taxId;
        bool isActive;
        uint256 registrationDate;
    }

    uint256 private _nextId = 1;
    uint256[] private _ids;
    mapping(uint256 => Company) private _companies;
    mapping(address => uint256) private _addressToId;

    address public authorized;

    event CompanyRegistered(uint256 indexed companyId, address indexed companyAddress, string name);
    event CompanyDeactivated(uint256 indexed companyId);

    error Unauthorized();
    error AlreadyRegistered();
    error CompanyNotFound();
    error ZeroAddress();
    error EmptyName();

    modifier onlyAuthorized() {
        if (msg.sender != authorized) revert Unauthorized();
        _;
    }

    constructor(address _authorized) {
        if (_authorized == address(0)) revert ZeroAddress();
        authorized = _authorized;
    }

    function registerCompany(
        address companyAddress,
        string calldata name,
        string calldata description,
        string calldata taxId
    ) external onlyAuthorized returns (uint256) {
        if (companyAddress == address(0)) revert ZeroAddress();
        if (bytes(name).length == 0) revert EmptyName();
        if (_addressToId[companyAddress] != 0) revert AlreadyRegistered();

        uint256 id = _nextId++;
        _companies[id] = Company({
            companyId: id,
            companyAddress: companyAddress,
            name: name,
            description: description,
            taxId: taxId,
            isActive: true,
            registrationDate: block.timestamp
        });
        _ids.push(id);
        _addressToId[companyAddress] = id;

        emit CompanyRegistered(id, companyAddress, name);
        return id;
    }

    function deactivateCompany(uint256 companyId) external onlyAuthorized {
        if (_companies[companyId].companyId == 0) revert CompanyNotFound();
        _companies[companyId].isActive = false;
        emit CompanyDeactivated(companyId);
    }

    function getCompany(uint256 companyId) external view returns (Company memory) {
        if (_companies[companyId].companyId == 0) revert CompanyNotFound();
        return _companies[companyId];
    }

    function getCompanyIdByAddress(address companyAddress) external view returns (uint256) {
        return _addressToId[companyAddress];
    }

    function getAllCompanyIds() external view returns (uint256[] memory) {
        return _ids;
    }
}
