// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./contracts/Errors.sol";

// Parent contract that creates a child and captures return data
contract ReturnDataTester {
    uint256 public returndatasize;

    function createChildContract() external {
        new Errors();
        uint256 size;
        assembly {
            size := returndatasize()
        }
        returndatasize = size;
    }

    // Read-only function to return the captured return data size
    function getCapturedReturnDataSize() external view returns (uint256) {
        return returndatasize;
    }
}
