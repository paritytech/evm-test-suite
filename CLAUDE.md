# EVM Test Suite

Deno 2.x test suite that validates Ethereum JSON-RPC compatibility for Polkadot's Revive (pallet-revive) against Geth as reference.

## Quick Reference

| Command                      | What it does                                                         |
| ---------------------------- | -------------------------------------------------------------------- |
| `deno task test:evm`         | Build + test EVM bytecode on Revive (auto-starts dev-node + eth-rpc) |
| `deno task test:pvm`         | Build + test PVM bytecode on Revive (auto-starts dev-node + eth-rpc) |
| `deno task test:geth`        | Build + test EVM bytecode on Geth (reference)                        |
| `deno task test:evm:manual`  | EVM tests without auto-starting services                             |
| `deno task test:pvm:manual`  | PVM tests without auto-starting services                             |
| `deno task test:update`      | Update snapshots from Geth                                           |
| `deno task build`            | Compile contracts (solc + resolc)                                    |
| `deno task build --solcOnly` | Compile contracts (solc only, faster)                                |
| `deno task lint`             | Format check + lint                                                  |

## Architecture

- **Contracts:** `contracts/*.sol` — Solidity 0.8.30
- **Generated code:** `codegen/abi/` (TS ABIs), `codegen/evm/` (.bin), `codegen/pvm/` (.polkavm)
- **Tests:** `src/all-tests.ts` is the entry point, imports all `src/*.test.ts` files
- **Setup:** `src/test-setup.ts` handles service lifecycle (start/stop dev-node, eth-rpc, geth)
- **Utilities:** `src/util.ts` — wallets, RPC client extensions, memoization helpers

## Environment Variables

| Variable                | Purpose                 | Default                                       |
| ----------------------- | ----------------------- | --------------------------------------------- |
| `USE_BYTECODE`          | `evm` or `pvm`          | —                                             |
| `START_REVIVE_DEV_NODE` | Auto-start dev-node     | —                                             |
| `START_ETH_RPC`         | Auto-start eth-rpc      | —                                             |
| `START_GETH`            | Auto-start geth         | —                                             |
| `REVIVE_DEV_NODE_PATH`  | Path to dev-node binary | `~/polkadot-sdk/target/debug/revive-dev-node` |
| `ETH_RPC_PATH`          | Path to eth-rpc binary  | `~/polkadot-sdk/target/debug/eth-rpc`         |
| `GETH_PATH`             | Path to geth binary     | `geth`                                        |
| `RPC_PORT`              | JSON-RPC port           | `8545`                                        |

## CI Jobs (polkadot-sdk)

The `tests-evm.yml` workflow in polkadot-sdk runs two matrix jobs:

- **evm-test-suite (test:evm):** Builds eth-rpc + revive-dev-node in release mode, checks out this repo, runs `deno task test:evm`
- **evm-test-suite (test:pvm):** Same build, runs `deno task test:pvm`

## Testing Patterns

- Use `memoizedDeploy()` for contract deployment (cached per test run)
- Snapshot tests compare against Geth output — update with `deno task test:update`
- `visit()` helper normalizes dynamic values (addresses, gas) for snapshot comparison
- Tests detect platform via `web3_clientVersion` and skip platform-specific assertions
