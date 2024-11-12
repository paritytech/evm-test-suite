import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";

const rpcUrl = process.env.NETWORK_URL;

const config: HardhatUserConfig = {
  solidity: { version: '0.8.27' },
  networks: {
    acala: {
      accounts: {
        mnemonic: "fox sight canyon orphan hotel grow hedgehog build bless august weather swarm",
        path:"m/44'/60'/0'/0"
      },
      chainId: 787,
      url: `${rpcUrl}`
    },
  },
};

export default config;
