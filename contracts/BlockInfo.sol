// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract BlockInfo {
    function blockInfo() external view returns (uint256 timestamp, uint256 blockNumber) {
        return (block.timestamp, block.number);
    }
}
