/// ENVVAR
// - COMPILER:      compiler version (default: 0.8.24)
// - SRC:           contracts folder to compile (default: contracts)
// - RUNS:          number of optimization runs (default: 200)
// - IR:            enable IR compilation (default: false)
// - COVERAGE:      enable coverage report (default: false)
// - GAS:           enable gas report (default: false)
// - COINMARKETCAP: coinmarketcap api key for USD value in gas report
// - CI:            output gas report to file instead of stdout

const fs = require('fs');
const path = require('path');
const { execSync } = require("child_process");
const { argv } = require('yargs/yargs')()
  .env('')
  .options({
    // Compilation settings
    compiler: {
      alias: 'compileVersion',
      type: 'string',
      default: '0.8.24',
    },
    src: {
      alias: 'source',
      type: 'string',
      default: 'contracts',
    },
    runs: {
      alias: 'optimizationRuns',
      type: 'number',
      default: 200,
    },
    ir: {
      alias: 'enableIR',
      type: 'boolean',
      default: false,
    },
    evm: {
      alias: 'evmVersion',
      type: 'string',
      default: 'cancun',
    },
    // Extra modules
    coverage: {
      type: 'boolean',
      default: false,
    },
    gas: {
      alias: 'enableGasReport',
      type: 'boolean',
      default: false,
    },
    coinmarketcap: {
      alias: 'coinmarketcapApiKey',
      type: 'string',
    },
  });

require('@nomicfoundation/hardhat-chai-matchers');
require('@nomicfoundation/hardhat-ethers');
require('hardhat-exposed');
require('hardhat-gas-reporter');
// require('hardhat-ignore-warnings'); // Incompatibility detected
require('solidity-coverage');
require('solidity-docgen');
require('hardhat-resolc');
require('hardhat-revive-node');

const nodePath = process.env.NODE_PATH;
const adapterPath = process.env.ADAPTER_PATH;
const compilerPath = process.env.COMPILER_PATH;
const useForking = process.env.USE_FORKING;

for (const f of fs.readdirSync(path.join(__dirname, 'hardhat'))) {
  require(path.join(__dirname, 'hardhat', f));
}

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  allowUnlimitedInitCodeSize: true,
  solidity: {
    version: argv.compiler,
    settings: {
      optimizer: {
        enabled: true,
        runs: argv.runs,
      },
      evmVersion: argv.evm,
      viaIR: argv.ir,
      outputSelection: { '*': { '*': ['storageLayout'] } },
    },
  },
  warnings: {
    'contracts-exposed/**/*': {
      'code-size': 'off',
      'initcode-size': 'off',
    },
    '*': {
      'code-size': true,
      'unused-param': !argv.coverage, // coverage causes unused-param warnings
      'transient-storage': false,
      default: 'error',
    },
  },
  networks: {
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
      evmVersion: "cancun",
      compilerPath: `${compilerPath}`,
      standardJson: true,
    },
  },
  exposed: {
    imports: true,
    initializers: true,
    exclude: ['vendor/**/*', '**/*WithInit.sol'],
  },
  gasReporter: {
    enabled: argv.gas,
    showMethodSig: true,
    includeBytecodeInJSON: true,
    currency: 'USD',
    coinmarketcap: argv.coinmarketcap,
  },
  paths: {
    sources: argv.src,
  },
  docgen: require('./docs/config'),
  mocha: {
    rootHooks: {
      beforeAll: async function () {
        console.log("Running setup script before tests...");
        try {
          const _ = execSync(`npx hardhat run scripts/endowAccounts.js --network localhost --no-compile`, { stdio: "inherit" });
        } catch (error) {
          console.error("Error executing script:", error);
          process.exitCode = 1;
        }
      },
      afterAll: function () {
        const currentDateTime = new Date().toString();
        console.log(currentDateTime);
      }
    },
    timeout: 40000,
  }
};


//ERC20WithAutoMinerReward removed due to coinbase
// Clones removed due to EXTCODECOPY
// mine, loadFixture, impersonateAccount, setStorageAt, setCode, mineUpTo, time

/**
 * **mine**
 * mine just mines an extra block so it could be changed for something like an waitForNextBlock
 */

/**
 * **impersonateAccount**
 * AccessManaged.test.js
 * AccessManager.predicate.js via testAsSchedulableOperation, present in AccessManager.behavior.js, AccessManager.predicate.js, AccessManager.test.js
 * AccessManager.test.js
 * ERC2771Context.test.js
 */

/**
 * **setStorageAt**
 * AccessManager.predicate.js
 * storage.js in setSlot, present in ERC1967Utils.test.js
 */

/**
 *  **setCode**
 * erc4337-entrypoint.js uses
 * Packing.test.js uses forceDeployCode but might be changed
 * draft-ERC4337Utils.test.js has some instances of deployEntrypoint(), which uses forceDeployCode(), which uses deployEntrypoint()
 * Packing.test.js could be salvaged
 */

/**
 * time.latestBlock() can be mocked
 * time.latest() can be mocked
 * increaseTo() can't because of time.increaseTo()
 * increaseBy() either because of increaseTo()
 * time.duration can be mocked
 */

/**
 * IGNORE EVERY ACCESS TEST
 */



