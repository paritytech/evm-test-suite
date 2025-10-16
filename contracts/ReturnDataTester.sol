// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Child contract with dummy state passed through constructor
contract Child {
}

// Parent contract that creates a child and captures return data
contract ReturnDataTester {
    uint public returndatasize;

    function createChildContract() external {
        new Child();
        uint size;
        assembly {
            size := returndatasize()
        }
        returndatasize = size;
    }

    // Read-only function to return the captured return data size
    function getCapturedReturnDataSize() external view returns (uint) {
        return returndatasize;
    }
}