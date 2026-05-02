// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CompanyRegistry} from "../src/CompanyRegistry.sol";

contract CompanyRegistryTest is Test {
    CompanyRegistry registry;
    address addr1 = makeAddr("company1");
    address addr2 = makeAddr("company2");

    function setUp() public {
        registry = new CompanyRegistry(address(this));
    }

    function test_RegisterCompany() public {
        uint256 id = registry.registerCompany(addr1, "ACME", "A company", "TAX123");
        assertEq(id, 1);
        CompanyRegistry.Company memory c = registry.getCompany(1);
        assertEq(c.companyAddress, addr1);
        assertEq(c.name, "ACME");
        assertEq(c.taxId, "TAX123");
        assertTrue(c.isActive);
        assertEq(c.registrationDate, block.timestamp);
    }

    function test_RegisterEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit CompanyRegistry.CompanyRegistered(1, addr1, "ACME");
        registry.registerCompany(addr1, "ACME", "desc", "TAX1");
    }

    function test_RevertDuplicateRegistration() public {
        registry.registerCompany(addr1, "ACME", "desc", "TAX1");
        vm.expectRevert(CompanyRegistry.AlreadyRegistered.selector);
        registry.registerCompany(addr1, "Other", "desc2", "TAX2");
    }

    function test_RevertZeroAddress() public {
        vm.expectRevert(CompanyRegistry.ZeroAddress.selector);
        registry.registerCompany(address(0), "ACME", "desc", "TAX1");
    }

    function test_RevertEmptyName() public {
        vm.expectRevert(CompanyRegistry.EmptyName.selector);
        registry.registerCompany(addr1, "", "desc", "TAX1");
    }

    function test_DeactivateCompany() public {
        registry.registerCompany(addr1, "ACME", "desc", "TAX1");
        registry.deactivateCompany(1);
        CompanyRegistry.Company memory c = registry.getCompany(1);
        assertFalse(c.isActive);
    }

    function test_DeactivateEmitsEvent() public {
        registry.registerCompany(addr1, "ACME", "desc", "TAX1");
        vm.expectEmit(true, false, false, false);
        emit CompanyRegistry.CompanyDeactivated(1);
        registry.deactivateCompany(1);
    }

    function test_RevertDeactivateNotFound() public {
        vm.expectRevert(CompanyRegistry.CompanyNotFound.selector);
        registry.deactivateCompany(999);
    }

    function test_GetCompanyIdByAddress() public {
        registry.registerCompany(addr1, "ACME", "desc", "TAX1");
        assertEq(registry.getCompanyIdByAddress(addr1), 1);
        assertEq(registry.getCompanyIdByAddress(addr2), 0);
    }

    function test_MultipleCompanies() public {
        uint256 id1 = registry.registerCompany(addr1, "ACME", "desc", "TAX1");
        uint256 id2 = registry.registerCompany(addr2, "Beta", "desc", "TAX2");
        assertEq(id1, 1);
        assertEq(id2, 2);
        uint256[] memory ids = registry.getAllCompanyIds();
        assertEq(ids.length, 2);
    }

    function test_RevertUnauthorized() public {
        vm.prank(addr1);
        vm.expectRevert(CompanyRegistry.Unauthorized.selector);
        registry.registerCompany(addr2, "ACME", "desc", "TAX1");
    }

    function test_RevertGetNotFound() public {
        vm.expectRevert(CompanyRegistry.CompanyNotFound.selector);
        registry.getCompany(999);
    }
}
