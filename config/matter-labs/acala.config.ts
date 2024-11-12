import { HardhatUserConfig, subtask } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } from "hardhat/builtin-tasks/task-names";

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(async (_, __, runSuper) => {
  const paths = await runSuper();

  return paths.filter((p: any) => {
    return (!p.includes("/many_arguments") && !p.includes("/constructor") && !p.includes("/function") && !p.includes("/loop") && !p.includes("/return"))
  });
});

const DEFAULT_COMPILER_SETTINGS = {
  version: '0.8.23',
}
const rpcUrl = process.env.NETWORK_URL;

const config: HardhatUserConfig = {
 paths: {
    sources: "./contracts/era-compiler-tests/solidity/simple",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  solidity: {
    compilers: [DEFAULT_COMPILER_SETTINGS],
    overrides: {
      'contracts/era-compiler-tests/solidity/simple/yul_instructions/basefee.sol': {version: '0.8.7'},
      'contracts/era-compiler-tests/solidity/simple/yul_instructions/difficulty.sol': {version: '0.8.17'},
      'contracts/era-compiler-tests/solidity/simple/immutable/trycatch.sol': {version: '0.8.19'},
      'contracts/era-compiler-tests/solidity/simple/internal_function_pointers/legacy/basic.sol': {version: '0.4.21'},
      'contracts/era-compiler-tests/solidity/simple/internal_function_pointers/legacy/inherited_1.sol': {version: '0.4.21'},
      'contracts/era-compiler-tests/solidity/simple/internal_function_pointers/legacy/inherited_2.sol': {version: '0.4.21'},
      'contracts/era-compiler-tests/solidity/simple/internal_function_pointers/legacy/invalidInConstructor.sol': {version: '0.4.21'},
      'contracts/era-compiler-tests/solidity/simple/internal_function_pointers/legacy/invalidStoredInConstructor.sol': {version: '0.4.21'},
      'contracts/era-compiler-tests/solidity/simple/internal_function_pointers/legacy/store2.sol': {version: '0.4.21'},
      'contracts/era-compiler-tests/solidity/simple/internal_function_pointers/legacy/storeInConstructor.sol': {version: '0.4.21'},
      'contracts/era-compiler-tests/solidity/simple/system/difficulty_returndata.sol': {version: '0.8.17'}
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000000,
      },
      viaIR: true,
      metadata: {
        // do not include the metadata hash, since this is machine dependent
        // and we want all generated code to be deterministic
        // https://docs.soliditylang.org/en/v0.7.6/metadata.html
        bytecodeHash: 'none',
      },
    },
  },
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
