import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const DEFAULT_COMPILER_SETTINGS = {
  version: '0.8.20',
}
const rpcUrl = process.env.NETWORK_URL;

const config: HardhatUserConfig = {
  solidity: {
    compilers: [DEFAULT_COMPILER_SETTINGS],
    overrides: {
      'contracts/yul_instructions/basefee.sol': {version: '0.8.7'},
      'contracts/yul_instructions/difficulty.sol': {version: '0.8.17'},
      'contracts/immutable/trycatch.sol': {version: '0.8.19'},
      'contracts/internal_function_pointers/legacy/basic.sol': {version: '0.4.21'},
      'contracts/internal_function_pointers/legacy/inherited_1.sol': {version: '0.4.21'},
      'contracts/internal_function_pointers/legacy/inherited_2.sol': {version: '0.4.21'},
      'contracts/internal_function_pointers/legacy/invalidInConstructor.sol': {version: '0.4.21'},
      'contracts/internal_function_pointers/legacy/invalidStoredInConstructor.sol': {version: '0.4.21'},
      'contracts/internal_function_pointers/legacy/store2.sol': {version: '0.4.21'},
      'contracts/internal_function_pointers/legacy/storeInConstructor.sol': {version: '0.4.21'},
      'contracts/system/difficulty_returndata.sol': {version: '0.8.17'}
    },
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 800,
      },
      metadata: {
        // do not include the metadata hash, since this is machine dependent
        // and we want all generated code to be deterministic
        // https://docs.soliditylang.org/en/v0.7.6/metadata.html
        bytecodeHash: 'none',
      },
    },
  },
  networks: {
    hardhat: {
      chains: {
        1: {
          hardforkHistory: {
            berlin: 10000000,
            london: 20000000,
          },
        }
      },
      forking: {
        url: `${rpcUrl}`
      },
    },
  },
};

export default config;
