// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Time {
    uint256 public eta = block.timestamp;

    function update() external {
        if (block.timestamp <= eta) {
            revert("Cannot update: Not enough time has passed");
        }
        eta = block.timestamp;
    }

    function setEta(uint256 newEta) external {
        eta = newEta;
    }
}
