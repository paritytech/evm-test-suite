import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";

const rpcUrl = process.env.NETWORK_URL;

const config: HardhatUserConfig = {
  solidity: { version: '0.8.27' },
  networks: {
    astar: {
      chainId: 592,
      url: `${rpcUrl}`
    },
  },
};

export default config;
