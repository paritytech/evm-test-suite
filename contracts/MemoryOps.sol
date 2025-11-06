// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Verifies opcode behavior during constructor execution
contract MemoryOps {
    uint256 public codeSize;
    uint256 public callDataSize;
    bytes32 public callDataLoad;
    bytes32 public callDataCopyHash;
    bytes32 public codeCopyHash;

    bool public arg;

    constructor(bool _arg) {
        arg = _arg;

        assembly {
        // CODESIZE should return length of initcode ++ calldata
        sstore(0, codesize())

        // CALLDATASIZE should return 0 (empty buffer)
        sstore(1, calldatasize())

        // CALLDATALOAD should return 0 (empty buffer)
        sstore(2, calldataload(0))

        // CALLDATACOPY - should copy from empty buffer
        let cds := calldatasize()
        calldatacopy(0, 0, cds)
        sstore(3, keccak256(0, cds))

        // CODECOPY - copy all of initcode++calldata to memory
        let cs := codesize()
        codecopy(0, 0, cs)
        sstore(4, keccak256(0, cs))
        }
    }

    // Public function to test opcodes in regular function context
    function call(bool _arg) public {
        arg = _arg;
        assembly {
            // CODESIZE should return length of deployed bytecode
            sstore(0, codesize())

            // CALLDATASIZE should return length of calldata
            sstore(1, calldatasize())

            // CALLDATALOAD should return first 32 bytes of calldata (function selector + args)
            sstore(2, calldataload(0))

            // CALLDATACOPY - should copy calldata to memory
            let cds := calldatasize()
            calldatacopy(0, 0, cds)
            sstore(3, keccak256(0, cds))
        }
    }

}
