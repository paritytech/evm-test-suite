---
description: Build Revive, start dev stack, and run EVM tests
allowed-tools: Bash(node-env:*), Bash(tmux:*), Bash(deno:*), Bash(curl:*), Bash(kill:*), Bash(lsof:*)
model: haiku
---

Build revive-dev-node + eth-rpc, start the dev stack via node-env, then run EVM tests.

Requires `node-env` on PATH. Clone from https://github.com/paritytech/node-env and add `~/github/node-env/bin` to PATH.

## Steps

0. Find the evm-test-suite repo by running `git -C "$(find ~ -maxdepth 3 -name 'evm-test-suite' -type d 2>/dev/null | head -1)" rev-parse --show-toplevel`. Use this path for subsequent commands.

1. Build and start the Revive dev stack:

```
node-env revive-dev-stack --build
```

Wait for the output to confirm eth-rpc is ready on `http://localhost:8545`.

2. Build contracts and run EVM tests (manual mode — services already running):

```
cd <evm-test-suite-path> && deno task test:evm:manual
```

## Interpreting Results

After tests complete, summarize:

- Total tests run, passed, failed, skipped
- If there are failures, show the failing test names and error messages
