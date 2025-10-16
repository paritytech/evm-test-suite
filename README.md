# EVM Test Suite

This repository contains a test suite for Ethereum rpc methods.

## Prerequisites

- [Deno](https://deno.land/) runtime installed (v1.40 or higher recommended)

## Running Tests

### Quick Test Run

To run tests against an already running Ethereum node:

```bash
deno task test
```

This command runs the test suite assuming you have an Eth RPC server already running.

### Full Test Run (with rpc startup)

To automatically start all required services and run the full test suite:

```bash
deno task test:full
```

This will:

- Start Geth (Ethereum client)
- Start the revive dev node
- Start ETH RPC server
- Run the complete test suite

### Build Contracts

To compile the Solidity contracts used in tests:

```bash
deno task build
```

### Linting

To check code formatting and run linter:

```bash
deno task lint
```

## Available Test Suites

- **Methods Tests** - Tests for standard Ethereum RPC methods
- **Tracing Tests** - Tests for debug tracing (callTracer, prestateTracer)
- **Error Handling Tests** - Tests for proper error responses
- **Others** - Miscellaneous test cases

## Test Configuration

Tests are configured via environment variables:

- `START_GETH=1` - Automatically start Geth
- `START_REVIVE_DEV_NODE=1` - Automatically start Revive dev node
- `START_ETH_RPC=1` - Automatically start ETH RPC server
- `USE_GETH=1` - Run tests against Geth (uses EVM bytecode)
- `USE_ETH_RPC=1` - Run tests against ETH RPC with both PVM and EVM bytecode
