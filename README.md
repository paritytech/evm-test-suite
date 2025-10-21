# EVM Test Suite

This repository contains a test suite for Ethereum rpc methods.

## Prerequisites

- [Deno](https://deno.land/) runtime installed (v1.40 or higher recommended)

## Running Tests

```bash
# start revive and eth rpc, then run tests with pvm bytecode
deno task test:pvm
# start revive and eth rpc, then run tests with evm bytecode
deno task test:evm
# start geth, then run tests with evm bytecode
deno task test:geth
```

## Building contracts

Contracts bytecode and abi is checked in into this repository, if you need to add new contracts, you can simply run the build command:

```bash
deno task build
```

### Linting

To check code formatting and run linter:

```bash
deno task lint
```

## Test Configuration

Tests are configured via environment variables:

- `RPC_PORT` - Specify custom JSON-RPC port (default: 8545)

- `START_GETH=1` - Start Geth
- `USE_GETH=1` - Run tests against Geth.
- `GETH_PATH` - Path to the Geth binary (default: to geth)

- `START_ETH_RPC=1` - Automatically start revive eth-rpc server
- `ETH_RPC_PATH` - Path to the eth-rpc binary (default: to ~/polkadot-sdk/target/debug/eth-rpc)
- `USE_REVIVE=evm|pvm` - Whether to run tests against revive with evm or pvm bytecode, default to `evm` if not specified

- `START_REVIVE_DEV_NODE=1` - Start Revive dev node
- `REVIVE_DEV_NODE_PATH` - Path to the Revive dev node binary (default: to ~/polkadot-sdk/target/debug/revive-dev-node)
