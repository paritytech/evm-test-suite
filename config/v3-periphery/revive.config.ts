import "@nomicfoundation/hardhat-toolbox";

import { HardhatUserConfig } from "hardhat/config";

import '../../hardhat-revive/compile'

const rpcUrl = process.env.NETWORK_URL;

const config: HardhatUserConfig = {
  solidity: undefined,
  networks: {
    revive: {
      accounts: {
        mnemonic: "bottom drive obey lake curtain smoke basket hold race lonely fit walk",
        path:"m/44'/60'/0'/0"
      },
      chainId: 420420421,
      url: `${rpcUrl}`
    },
  },
};

export default config;
