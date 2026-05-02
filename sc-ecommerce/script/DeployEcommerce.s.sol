// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {EcommerceMain} from "../src/EcommerceMain.sol";

contract DeployEcommerce is Script {
    function run(address euroToken) external {
        vm.startBroadcast();
        EcommerceMain ecommerce = new EcommerceMain(euroToken);
        ecommerce.initialize();
        vm.stopBroadcast();

        console.log("EcommerceMain desplegado en: %s", address(ecommerce));
    }
}
