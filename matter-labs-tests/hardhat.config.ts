import { HardhatUserConfig, subtask } from "hardhat/config";
import { execSync } from "child_process";
import "@nomicfoundation/hardhat-toolbox";
import { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } from "hardhat/builtin-tasks/task-names";

import "hardhat-resolc";
import "hardhat-revive-node";

const nodePath = process.env.NODE_PATH;
const adapterPath = process.env.ADAPTER_PATH;
const compilerPath = process.env.COMPILER_PATH;
const useForking = process.env.USE_FORKING;
const rpcUrl = process.env.NETWORK_URL;
const testFilter = process.env.TEST_FILTER;

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(async (_, __, runSuper) => {
  const paths = await runSuper();

  if (testFilter && testFilter.length > 0 && testFilter != "--") {
    return paths.filter((p: any) => {
      return (
        (p.includes(`${testFilter.toString()}`))
        && !p.includes('/many_arguments')
        && !p.includes('/immutable/trycatch.sol')
        && !p.includes('/internal_function_pointers/legacy/basic.sol')
        && !p.includes('/internal_function_pointers/legacy/inherited_1.sol')
        && !p.includes('/internal_function_pointers/legacy/inherited_2.sol')
        && !p.includes('/internal_function_pointers/legacy/invalidInConstructor.sol')
        && !p.includes('/internal_function_pointers/legacy/invalidStoredInConstructor.sol')
        && !p.includes('/internal_function_pointers/legacy/storeInConstructor.sol')
        && !p.includes('/system/difficulty_returndata.sol')
        && !p.includes('/yul_instructions/difficulty.sol') 
        && !p.includes('/internal_function_pointers/legacy/store2.sol')
        && !p.includes('/yul_instructions/prevrandao.sol')
        && !p.includes('/system/prevrandao_returndata.sol')
        && !p.includes('/yul_instructions/msize.sol')
        && !p.includes('/system/msize_returndata.sol')
      )
    });
  } else {
    return paths.filter((p: any) => {
      return (
        !p.includes('/many_arguments') 
        && !p.includes('/immutable/trycatch.sol')
        && !p.includes('/internal_function_pointers/legacy/basic.sol')
        && !p.includes('/internal_function_pointers/legacy/inherited_1.sol')
        && !p.includes('/internal_function_pointers/legacy/inherited_2.sol')
        && !p.includes('/internal_function_pointers/legacy/invalidInConstructor.sol')
        && !p.includes('/internal_function_pointers/legacy/invalidStoredInConstructor.sol')
        && !p.includes('/internal_function_pointers/legacy/storeInConstructor.sol')
        && !p.includes('/system/difficulty_returndata.sol')
        && !p.includes('/yul_instructions/difficulty.sol')
        && !p.includes('/internal_function_pointers/legacy/store2.sol')
        && !p.includes('/yul_instructions/prevrandao.sol')
        && !p.includes('/system/prevrandao_returndata.sol')
        && !p.includes('/yul_instructions/msize.sol')
        && !p.includes('/system/msize_returndata.sol')
      )
    });
  }
});

const DEFAULT_COMPILER_SETTINGS = {
  version: '0.8.23',
}
const bSize = process.env.BATCH_SIZE ? Number.parseInt(process.env.BATCH_SIZE) : undefined;

const config: HardhatUserConfig = {
  paths: {
    sources: "./contracts/era-compiler-tests/solidity/simple",
    tests: "./test",
    cache: "./cache-pvm",
    artifacts: "./artifacts-pvm"
  },
  mocha: {
    rootHooks: {
      beforeAll: async function () {
        console.log("Running setup script before tests...");

        try {
          // Ensure the script is being executed correctly
          execSync(`npx hardhat run scripts/endowAccounts.ts --network localhost --no-compile`, { stdio: "inherit" });
        } catch (error) {
          console.error("Error executing script:", error);
          process.exitCode = 1;
        }
      },
    },
    timeout: 40000,
  },
  solidity: {
    compilers: [DEFAULT_COMPILER_SETTINGS],
    settings: {
      optimizer: {
        enabled: true,
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
    localhost: {
      accounts: [
        '0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133',
        '0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5b0000a702133',
        '0x5fb92c48bebcd6e98884f76de468fa3f6278f880713595d45af5b0000a702133',
        '0x5fb92d6de468fa3f6278f8807c48bebc13595d45af5b000e98884f760a702133',
        '0x5fb92d6e98884f76de468fa3f6278f8807c48bebc130a702133595d45af5b000',
        '0x5fb92d6e98884f76de468fa3f6275af5b0000a7021bc338f8807c48be13595d4',
        '0x521338f8807c48befb92d6e98884f76de468fa3f6275af5b0000a70bc13595d4',
        '0x5fb92d6e9884f768de468fa3f6275af5b0000a7021338f8807c48bebc13595d4',
        '0x5fb92d6de468fa3f6275af5b0000a7021338f8807c48bebc13595d46e98884f7',
        '0x5fb92d6e98884f76de468fa3f6275af5b0000a7021338f8807c48be3595d4bc1',
      ]
    },
    hardhat: {
      polkavm: true,
      forking: `${useForking}` === "true"
        ? {
          url: `${rpcUrl}`,
        }
        : undefined,
      nodeConfig: {
        nodeBinaryPath: `${nodePath}`,
        rpcPort: 8000,
        dev: true,
      },
      adapterConfig: {
        adapterBinaryPath: `${adapterPath}`,
        dev: true,
      }
    },
  },
  resolc: {
    compilerSource: 'binary',
    settings: {
      optimizer: {
        enabled: true,
      },
      evmVersion: "london",
      compilerPath: `${compilerPath}`,
      standardJson: true,
      batchSize: bSize,
    },
  },
};

export default config;
