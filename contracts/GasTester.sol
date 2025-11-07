// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract GasTester {
    uint256 public value;

    constructor() payable {
        value = 0;
    }

    function setValue(uint256 v) external payable {
        value = v;
    }
}
