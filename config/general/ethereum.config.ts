import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";

const rpcUrl = process.env.NETWORK_URL;

const config: HardhatUserConfig = {
  solidity: { version: '0.8.27' },
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
      }
    },
  },
};

export default config;
