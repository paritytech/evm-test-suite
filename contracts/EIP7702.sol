// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Simple delegate contract that can be assigned to an EOA via EIP-7702
contract SimpleDelegate {
    // Stored in the EOA's storage when delegated
    uint256 public counter;

    event Incremented(address indexed account, uint256 newValue);

    function increment() external {
        counter++;
        emit Incremented(address(this), counter);
    }

    function getCounter() external view returns (uint256) {
        return counter;
    }

    function selfBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Accept ETH
    receive() external payable {}
}
