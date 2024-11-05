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
      'contracts/immutable/trycatch.sol': {version: '0.8.19'}
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000000,
      },
      viaIR: true,
    }
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
