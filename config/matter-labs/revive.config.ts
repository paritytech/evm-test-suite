import { HardhatUserConfig, subtask } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } from "hardhat/builtin-tasks/task-names";
import '../../hardhat-revive/compile'

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(async (_, __, runSuper) => {
  const paths = await runSuper();

  return paths.filter((p: any) => {
    return (!p.includes("/many_arguments") && !p.includes("/constructor") && !p.includes("/function") && !p.includes("/loop") && !p.includes("/return"))
  });
});

const rpcUrl = process.env.NETWORK_URL;

const config: HardhatUserConfig = {
 paths: {
    sources: "./contracts/era-compiler-tests/solidity/simple",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
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
