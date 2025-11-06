// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

//  Verifies opcode behavior during constructor execution
contract MemoryOps {
    uint256 public codeSize;
    uint256 public callDataSize;
    bytes32 public callDataLoad;
    bytes32 public codeCopyHash;

    constructor(uint256, uint256, string memory) {
        assembly {
            // CODESIZE should return length of initcode ++ calldata
            let cs := codesize()
            sstore(0, cs) // Store to codeSize slot

            // CALLDATASIZE should return 0 (empty buffer)
            let cds := calldatasize()
            sstore(1, cds) // Store to callDataSize slot

            // CALLDATALOAD should return 0 (empty buffer)
            let cdl := calldataload(0)
            sstore(2, cdl) // Store to callDataLoad slot

            // CODECOPY - copy all of initcode++calldata to memory
            codecopy(0, 0, cs)
            // Store the keccak256 hash of the entire code for verification
            sstore(3, keccak256(0, cs))

            // CALLDATACOPY - should copy from empty buffer
            // Copy calldatasize() bytes (should be 0) to memory
            calldatacopy(0, 0, cds)
        }
    }
}
