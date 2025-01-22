import { HardhatUserConfig, subtask } from "hardhat/config";
import { execSync } from "child_process";
import "@nomicfoundation/hardhat-toolbox";
import { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } from "hardhat/builtin-tasks/task-names";
// import "hardhat-resolc"
// import "hardhat-revive-node";
import '../../../hardhat-revive/packages/hardhat-resolc/src/index';
import '../../../hardhat-revive/packages/hardhat-revive-node/src/index';

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(async (_, __, runSuper) => {
  const paths = await runSuper();

  return paths.filter((p: any) => {
    return (
      !p.includes("/constructor") // ignore because hardhat typechain TypeError: (fileReexports[path] || []).sort is not a function - 9 solidity files
      && !p.includes("/function") // ignore because CompilerError: Stack too deep. Try compiling with `--via-ir` (cli) -  32 solidity files
      && !p.includes("/loop") // ignore because SyntaxError: Identifier expected. 'for' is a reserved word that cannot be used here - 38 solidity files
      && !p.includes("/return") // SyntaxError: Identifier expected. 'return' is a reserved word that cannot be used here - 10 solidity files
      && !p.includes("/simple/yul_instructions/returndatasize.sol") // ignore becuase SyntaxError: Identifier expected. 'return' is a reserved word that cannot be used here
      && !p.includes('/simple/yul_instructions/prevrandao.sol') // ignore becauase errors: Variable count for assignment to "result" does not match number of values (1 vs. 0)
      && !p.includes('/simple/yul_instructions/msize.sol') // ignore because SyntaxError: The msize instruction cannot be used when the Yul optimizer is activated because it can change its semantics. Either disable the Yul optimizer or do not use the instruction
      && !p.includes('/simple/yul_instructions/difficulty.sol') // ignore becuase ParseError: Source file requires different compiler version (current compiler is 0.8.25+commit.b61c2a91.Darwin.appleclang) - note that nightly builds are considered to be strictly less than the released version
      && !p.includes('/simple/yul_instructions/gaslimit.sol') // ignore because not implemented yet
      && !p.includes("/internal_function_pointers/legacy/inherited_1.sol") // ignore because requires 0.4.21
      && !p.includes("/internal_function_pointers/legacy/inherited_2.sol") // ignore because  requires 0.4.21
      && !p.includes("/internal_function_pointers/legacy/invalidInConstructor.sol") // ignore because  requires 0.4.21
      && !p.includes("/internal_function_pointers/legacy/basic.sol") // ignore because requires 0.4.21
      && !p.includes("/internal_function_pointers/legacy/invalidStoredInConstructor.sol") // ignore because requires 0.4.21
      && !p.includes("/internal_function_pointers/legacy/store2.sol") // ignore because requires 0.4.21
      && !p.includes("/internal_function_pointers/legacy/storeInConstructor.sol") // ignore because requires 0.4.21
      && !p.includes("/simple/system/difficulty_returndata.sol") // ignore because ParserError: Source file requires different compiler version (current compiler is 0.8.25+commit.b61c2a91.Darwin.appleclang)
      && !p.includes("/simple/system/msize_returndata.sol") // ignore because The msize instruction cannot be used when the Yul optimizer is activated because it can change its semantics. Either disable the Yul optimizer or do not use the instruction.
      && !p.includes("/simple/system/prevrandao_returndata.sol") // ignore because Function "prevrandao" not found.
      && !p.includes('/basefee.sol') // ignore because not implemented in the compiler yet
      && !p.includes('/trycatch.sol') // ignore because ParserError: Source file requires different compiler version (current compiler is 0.8.25+commit.b61c2a91.Darwin.appleclang) - note that nightly builds are considered to be strictly less than the released version
      && !p.includes('/coinbase.sol') // ignore because not implemented in the compiler yet
      && !p.includes('/gas_limit.sol') // ignore because not implemented in the compiler yet
    );
  });
});

const DEFAULT_COMPILER_SETTINGS = {
  version: '0.8.23',
}

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
        
        // Run the setup script
        try {
          // Ensure the script is being executed correctly
          execSync(`npx hardhat run scripts/endowAccounts.ts --network localhost --no-compile`, { stdio: "inherit" });
        } catch (error) {
          console.error("Error executing script:", error);
          process.exitCode = 1;
        }
          },
    }, 
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
    localhost : {
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
      nodeConfig: {
      nodeBinaryPath: '../../../polkadot-sdk/target/release/substrate-node',
        rpcPort: 8000,
        dev: true,
      },
      adapterConfig: {
        adapterBinaryPath: '../../../polkadot-sdk/target/release/eth-rpc',
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
      evmVersion: "istanbul",
      compilerPath: "../../../revive/target/release/resolc",
      standardJson: true,
    },
  },
};

export default config;
