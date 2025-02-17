### EVM Tests [WIP]

Set of generic tests to check for chain compatibility. It covers higher level 
tests derived from well-known smart contracts (such as uniswap v4, WIP), standard testing (such as [Open Zeppelin tests](https://github.com/OpenZeppelin/openzeppelin-contracts/tree/master/test)) and lower level testing inspired by [Matter Labs](https://github.com/matter-labs).

**NOTE**: For the time being, the `openzeppelin-tests` are disabled.

## Execution

This is a hybrid test suite that uses both [Hardhat](https://hardhat.org/) (and in the future
[Foundry](https://book.getfoundry.sh/)).

To run the tests, simply run the script `init.sh`:

```sh
~ ./init.sh <CHAIN> <URL> <TEST> <FORKING> <NODE_PATH> <ADADPTER_PATH> <COMPILER_PATH> <TEST_FILTER> <VERBOSE_LOGGING>
```

* CHAIN
* URL
* TEST
* FORKING
* NODE_PATH
* ADAPTER_PATH
* COMPILER_PATH
* TEST_FILTER
* VERBOSE_LOGGING


| 🔧 Parameter            | 📄 Description                                              |
|-------------------------|-------------------------------------------------------------|
| CHAIN                   | Chain preset that will be used.                             |
| URL                     | URL to connect to when forking.                             |
| TEST                    | Set of tests to run.                                        |
| FORKING                 | Boolean that defines whether to work with a forked chain.   |
| NODE_PATH               | Path to the `substrate-node` binary.                        |
| ADAPTER_PATH            | Path to the `eth-rpc` binary.                               |
| COMPILER_PATH           | Path to the `resolc` binary.                                |
| TEST_FILTER             | Value used to filter the contracts to be run.               |
| VERBOSE_LOGGING         | Boolean that defines whether to verbosely log tests.        |

Currently the available options for `CHAIN` to test against are:
* `--acala`
* `--arbitrum`
* `--astar`
* `--kitchensink`
* `--ethereum`
* `--moonbeam`
* `--polygon`
* `--westend`
* `--endpoint` or `-e`

With `--ethereum` being the default option.

When passing `--endpoint` or `-e`, the second argument must be the `http` endpoint
of the node you are connecting to. You must also set the
`USE_REVIVE` env var to either `true` or `false`, in order to enable compilation
to `PolkaVM` rather than `EVM`. If `USE_REVIVE` is set to `false`, it will use the
configuration inside of the project's `hardhat.config.ts`.

If choosing from a preset chain and specifying
a test, `--` should be passed for the `<URL>` argument, and the `USE_REVIVE` env
var is set automatically depending on the chain.

As for `TEST`, you can specify either `--matter-labs` to run the `matter-labs`
tests, `--open-zeppelin` to run the openzeppelin standard tests or `--geth-diff`
to run the geth differential tests. Not specifying the test will result in all
suites being executed consecutively.

When running the Kitchensink node, you must specify the `NODE_PATH`, `ADAPTER_PATH` and
the `COMPILER_PATH`. Setting `FORKING=true` and running a local node are not compatible.

This script will install the necessary packages and run the tests in order.

The test logs will be saved to `/test-logs/`, in order to allow the user to review
them after they are completed, since terminals may have a limited historical display.

In order for the commands to be parsed correctly, if you have parameters you are not using
before one you are using, you must set them as `--`, in order to keep the spacing correct.

When handling tests with a considerable amount of contracts to compile while
in resource-restricted environments such as Docker, it is recommended to define
the environment variable `BATCH_SIZE` in order to define the amount of contracts
that are compiled at once. This tells the plugin to split the contracts in subsets
of `length=BATCH_SIZE` and compile the batches sequentially.

**Example**

For example,

```bash
~ ./init.sh --kitchensink -- --matter-labs -- \
../../../polkadot-sdk/target/release/substrate-node \
../../../polkadot-sdk/target/release/eth-rpc \
../../revive/target/release/resolc
```

will run the Matter Labs test suite for a local Kitchensink node and store the output in the "output-logs" folder.

When running tests for `PolkaVM`, we recommend using a local Kitchensink node instead
of forking the live chain, since doing so may result in errors like
`CodeRejected` or `Metadata error: The generated code is not compatible with the node`
if either the local `resolc` or `eth-rpc` versions don't match the `PolkaVM` version
in the chain.

To make sure the versions match, we recommend building the compiler first and then
check inside pallet revive's [`Cargo.toml`](https://github.com/paritytech/revive/blob/fe1b3258d2956e51e2edd86f2e77898e6b142729/Cargo.toml#L76)
in order to see which commit of the polkadot-sdk you should use to build the
`substrate-node` and `eth-rpc` binaries.

## Matter Labs Test Options

### Filtering Contracts

When running matter labs tests with the `--matter-labs` option you can set the `TEST_FILTER` option in order to compile and run only a subset of the contracts.

Example:
```bash
./init.sh --ethereum -- --matter-labs -- -- -- -- /destructuring 
```
This will match for any matter-labs contract that includes the string `/destructuring` and only compile and run the given tests of those contracts. 

### Log Verbosity

When running matter labs tests with the `--matter-labs` option you can set the `VERBOSE_LOGGING` option to true in order to log additional test output which includes the method of the contract being called, its expected output and the actual output which was received.

Example:
```bash
./init.sh --ethereum -- --matter-labs -- -- -- -- -- true 
```

Note: These options are currently only available to use with Matter Labs tests with plans to expand them to additional tests.

## Open Zeppelin (OZ) Test Output

Open Zeppelin Test output consists of passing and failing tests as defined in the open-zeppelin suite of tests.

## OZ Passing Tests

An example of `passing` open-zeppelin test output looks like the following:

```bash
address
      ✔ starts empty
      add
        ✔ adds a value
        ✔ adds several values
        ✔ returns false when adding values already in the set
      at
        ✔ reverts when retrieving non-existent elements
        ✔ retrieves existing element
      remove
        ✔ removes added values
        ✔ returns false when removing values not in the set
        ✔ adds and removes multiple values
```
This log indicates the description of the group of tests being run (e.g. `address`), the description for different tests being run that belong to the described grouping of tests (e.g. `add`, `at` and `remove`) and the individual test cases of those tests (e.g. `adds a value`, `adds and removes multiple values` etc). Each case with a check represents a passing test.

## OZ Failing Tests

An example of `failing` open-zeppelin test output: 
```bash
1) Environment sanity
       snapshot
         cache and mine:

      AssertionError: expected 249 to equal 250
      + expected - actual

      -249
      +250
      
      at Context.<anonymous> (test/sanity.test.js:19:57)
```
This log indicates the description of the group of tests (e.g. `Environment sanity`), the description of the different tests being run that belong to that group (e.g. `snapshot`), the individual test cases for those tests (e.g. `cache and mine`) and the assertion error (and corresponding file/line where the error was thrown) which occurred for the test case.

## Matter Labs (ML) Test Output

Matter Labs Test output differs based on whether the test cases are considered passing, failing or  whitelisted.

## ML Passing Tests

Passing test output indicates that the results of deploying a contract or calling a given method in a contract returns the expected value. An example being:
```bash
    ✔ Tests for test case complex1 (126ms)
    Method complex: expected: ["12","128","255","0","123","12","68","192","2","19"] - actual: 12,128,255,0,123,12,68,192,2,19
```
This log indicates the test case that was run (e.g. `complex1`), the method that was called (e.g. `complex`) as well as the expected and actual output that was received.

## ML Failing Tests

Failing test output indicates that an expected result was not received. An example of failing test output looks like the following:
```bash
  Tests for test case complex1:
     AssertionError [ERR_ASSERTION]: Failed Test Case complex1 from contracts/era-compiler-tests/solidity/simple/algorithm/cryptography/book_cypher.sol calling method complex with inputs 1,12,55,53,22,34,45,21,12,7 - expected: ["1","12","55","53","22","34","45","21","12","7"], actual: ProviderError: Failed to instantiate contract: Module(ModuleError { index: 80, error: [10, 0, 0, 0], message: Some("ContractTrapped") })
      at Context.<anonymous> (test/MatterLabsTests.ts:447:49)
      at processTicksAndRejections (node:internal/process/task_queues:105:5)
```
This log indicates the test case being run (e.g. `complex1`), the contract the test case belongs to (`contracts/era-compiler-tests/solidity/simple/algorithm/cryptography/book_cypher.sol`), the method that was called (e.g. `complex`) as well as the expected and actual output that was received. The actual value for a failing test can be an error or some other unexpected value received from the contract call.

## ML Whitelisted Tests

There are some cases where there are tests which have been whitelisted and are currently expected to fail. These are limited and typically represent tests that are either expected to fail due to differences in runtime environments (e.g. geth vs polygon chainIds being different), contain methods not currently supported in the virtual machine or would otherwise break compilation for a given VM causing the test suite to fail (e.g. contracts with too many arguments).
```bash
✔ Tests for test case main (5167ms)
Deployed contracts/era-compiler-tests/solidity/simple/yul_instructions/basefee.sol:Test
whitelisted: Test Case default from contracts/era-compiler-tests/solidity/simple/yul_instructions/basefee.sol calling method main with inputs  - expected: ["7"], actual: AssertionError: expected +0 to equal 7
```
Whitelisted test logs are similar to passing/failing outputs except they do not influence the number of failing tests in the test suite.

## Contribute

Need help or want to contribute ideas or code? Head over to our [CONTRIBUTING](CONTRIBUTING.md) doc for more information.

**NOTE**

Some tests are expected to fail, and being actively worked on. Specifically, there
will be errors such as `the initcode size of this transaction is too large`,
this is because the `substrate-node` still isn't fully compatible with the `hardhat`
network specs, due to lacking some required rpc calls. This is being worked on
and once we have full compatibility, we can configure the tests to ignore this limit.
This size limit is the standard in `EVM` but is not the same as with `PolkaVM`.

The openzeppelin tests take a while to run against the Kitchensink node, around ~3hs.
This is due to the previously mentioned lack of full compatibility with the `hardhat`
network we cannot take advantage of hardhat-only helpers like `mine()` and `loadFixture()`,
and have to wait for the block to be produced and redeploy the contract each time
to replace these.

To run the tests with the default `--arbitrum` or `--polygon` options, you need
to set the env variable `PRIVATE_KEY` with your Infura API key. 

Tests take a while to run, and using the predetermined public endpoints may 
result in them taking longer timeouts or being banned due to the amount of requests,
so we highly recommend using the `-e` option.
