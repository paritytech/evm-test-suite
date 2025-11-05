// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Flipper - Stores and toggles a boolean value
contract Tester {
    uint256 public value;
    string public name;

    event TesterDeployed(address indexed creator);

    constructor() payable {
        emit TesterDeployed(msg.sender);
        value = 42;
        name = 'Hello world';
    }

    function setValue(uint256 v) external {
        value = v;
    }

    function setName(string memory v) external {
        name = v;
    }

    function revertme() external {
        require(false, "failed!");
    }

    function getBlockHash(uint256 blockNumber) external view returns (bytes32) {
        return blockhash(blockNumber);
    }
}
