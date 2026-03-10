---
description: Build Revive, start dev stack, and run PVM tests
allowed-tools: Bash(node-env:*), Bash(tmux:*), Bash(deno:*), Bash(curl:*), Bash(kill:*), Bash(lsof:*)
model: haiku
---

Build revive-dev-node + eth-rpc, start the dev stack via node-env, then run PVM tests.

Requires `node-env` on PATH. Install from `~/github/node-env` — add `~/github/node-env/bin` to PATH.

## Steps

1. Build and start the Revive dev stack:
```
node-env revive-dev-stack --build
```
Wait for the output to confirm eth-rpc is ready on `http://localhost:8545`.

2. Build contracts and run PVM tests (manual mode — services already running):
```
cd ~/github/evm-test-suite && deno task test:pvm:manual
```

## Interpreting Results

After tests complete, summarize:
- Total tests run, passed, failed, skipped
- If there are failures, show the failing test names and error messages
- PVM tests compile contracts with resolc (Revive compiler) targeting PolkaVM, so compilation takes longer
