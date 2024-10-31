import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";

const rpcUrl = process.env.NETWORK_URL;

const UNISWAP_V3_DEFAULT_COMPILER_SETTINGS = {
  version: '0.7.6',
  settings: {
    evmVersion: 'istanbul',
    optimizer: {
      enabled: true,
      runs: 1_000_000,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
};

const DEFAULT_COMPILER_SETTINGS = {
  version: '0.8.27',
};

const config: HardhatUserConfig = {
  solidity: {
    compilers: [DEFAULT_COMPILER_SETTINGS, UNISWAP_V3_DEFAULT_COMPILER_SETTINGS],
    overrides: {
      'contracts/v3-*/**/**.sol': UNISWAP_V3_DEFAULT_COMPILER_SETTINGS,
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: `${rpcUrl}`
      }
    },
  },

};

export default config;
