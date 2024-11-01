### EVM Tests [WIP]

Set of generic tests to check for chain compatibility. It covers higher level 
tests derived from Smart Contracts (such as Uniswap V3) and lower level testing inspired by [`Matter Labs`]
(https://github.com/matter-labs).

## Execution

To run the tests, simply run the script `init.sh`:

```sh
~ ./init.sh <CHAIN> <TEST>
```
Currently the available options for `CHAIN` to test against are:
* `--acala`
* `--moonbeam`
* `--astar`
* `--ehtereum`
* `--polygon`

With `--ethereum` being the default option.

As for `TEST`, you can specify either `--mater-labs` to run the `matter-labs`
tests or `--smart-contracts` to run the test that deploy and check against the
smart contracts (Uniswap V3 and some generic smart contracts, more tba). Not
specifying the test will result in both suites being executed consecutively.

This script will install the necessary packages and run the tests in order.

**NOTE**

As things are now, running both suites at the same time will result in timeouts.
Some tests are expected to fail, and being actively worked on.
