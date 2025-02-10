### EVM Tests [WIP]

Set of generic tests to check for chain compatibility. It covers higher level 
tests derived from well-known smart contracts (such as uniswap v4, WIP), standard testing (such as [Open Zeppelin tests](https://github.com/OpenZeppelin/openzeppelin-contracts/tree/master/test)) and lower level testing inspired by [Matter Labs](https://github.com/matter-labs).

## Execution

This is a hybrid test suite that uses both [Hardhat](https://hardhat.org/) (and in the future
[Foundry](https://book.getfoundry.sh/)).

To run the tests, simply run the script `init.sh`:

```sh
~ ./init.sh <CHAIN> <URL> <TEST> <FORKING> <NODE_PATH> <ADADPTER_PATH> <COMPILER_PATH>
```

* CHAIN
* URL
* TEST
* FORKING
* NODE_PATH
* ADAPTER_PATH
* COMPILER_PATH

| 🔧 Parameter            | 📄 Description                                              |
|-------------------------|-------------------------------------------------------------|
| CHAIN                   | Chain preset that will be used.                             |
| URL                     | URL to connect to when forking.                             |
| TEST                    | Set of tests to run.                                        |
| FORKING                 | Boolean that defines whether to work with a forked chain.   |
| NODE_PATH               | Path to the `substrate-node` binary.                        |
| ADAPTER_PATH            | Path to the `eth-rpc` binary.                               |
| COMPILER_PATH           | Path to the `resolc` binary.                                |

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
tests or `--open-zeppelin` to run the openzeppelin standard tests. Not
specifying the test will result in both suites being executed consecutively.

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
