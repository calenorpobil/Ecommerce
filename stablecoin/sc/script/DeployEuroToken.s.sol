// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {EuroToken} from "../src/EuroToken.sol";

contract DeployEuroToken is Script {
    uint256 constant INITIAL_MINT = 1_000_000 * 1e6; // 1.000.000 EURT

    function run() external returns (EuroToken token) {
        address deployer = vm.envOr("DEPLOYER_ADDRESS", msg.sender);

        vm.startBroadcast();

        token = new EuroToken(deployer);
        token.mint(deployer, INITIAL_MINT);

        vm.stopBroadcast();

        console.log("EuroToken deployed at:", address(token));
        console.log("Owner:", deployer);
        console.log("Initial supply:", INITIAL_MINT / 1e6, "EURT");
    }
}
