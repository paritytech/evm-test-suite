import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const rpcUrl = process.env.NETWORK_URL;

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      forking: {
        url: `${rpcUrl}`
      }
    },
  }
};

export default config;
