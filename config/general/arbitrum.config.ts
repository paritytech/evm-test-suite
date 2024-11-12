import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";

const rpcUrl = process.env.NETWORK_URL;

const config: HardhatUserConfig = {
  solidity: { version: '0.8.27' },
  networks: {
    hardhat: {
      chainId: 42161,
      forking: {
        url: `${rpcUrl}`
      }
    },
  },
};

export default config;
