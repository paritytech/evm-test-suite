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

- `START_GETH=1` - Automatically start Geth
- `START_REVIVE_DEV_NODE=1` - Automatically start Revive dev node
- `START_ETH_RPC=1` - Automatically start ETH RPC server
- `USE_GETH=1` - Run tests against Geth (uses EVM bytecode)
- `USE_ETH_RPC=1` - Run tests against ETH RPC with both PVM and EVM bytecode
