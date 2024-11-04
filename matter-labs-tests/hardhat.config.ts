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
    }
  },  networks: {
    hardhat: {
      forking: {
        url: `${rpcUrl}`
      },
    },
  },
};

export default config;
