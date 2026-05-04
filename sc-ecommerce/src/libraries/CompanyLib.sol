// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library CompanyLib {
    struct Company {
        uint256 companyId;
        address companyAddress;
        string name;
        string description;
        string taxId;
        bool isActive;
        uint256 registrationDate;
    }

    struct Data {
        uint256 nextId;
        uint256[] ids;
        mapping(uint256 => Company) companies;
        mapping(address => uint256) addressToId;
    }

    error AlreadyRegistered();
    error CompanyNotFound();
    error ZeroAddress();
    error EmptyName();

    function register(
        Data storage self,
        address companyAddress,
        string calldata name,
        string calldata description,
        string calldata taxId
    ) internal returns (uint256) {
        if (companyAddress == address(0)) revert ZeroAddress();
        if (bytes(name).length == 0) revert EmptyName();
        if (self.addressToId[companyAddress] != 0) revert AlreadyRegistered();

        uint256 id = ++self.nextId;
        self.companies[id] = Company({
            companyId: id,
            companyAddress: companyAddress,
            name: name,
            description: description,
            taxId: taxId,
            isActive: true,
            registrationDate: block.timestamp
        });
        self.ids.push(id);
        self.addressToId[companyAddress] = id;
        return id;
    }

    function deactivate(Data storage self, uint256 companyId) internal {
        if (self.companies[companyId].companyId == 0) revert CompanyNotFound();
        self.companies[companyId].isActive = false;
    }

    function get(Data storage self, uint256 companyId) internal view returns (Company memory) {
        if (self.companies[companyId].companyId == 0) revert CompanyNotFound();
        return self.companies[companyId];
    }

    function getIdByAddress(Data storage self, address addr) internal view returns (uint256) {
        return self.addressToId[addr];
    }
}
