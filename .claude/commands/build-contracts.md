---
description: Build Solidity contracts for EVM and PVM
allowed-tools: Bash(deno:*)
argument-hint: [--solcOnly]
model: haiku
---

Build the Solidity contracts in `contracts/` directory, generating ABI files and bytecode.

User provided these flags: `$ARGUMENTS`

First, find the evm-test-suite repo by running `git -C "$(find ~ -maxdepth 3 -name 'evm-test-suite' -type d 2>/dev/null | head -1)" rev-parse --show-toplevel`.

```
cd <evm-test-suite-path> && deno task build $ARGUMENTS
```

- Default: compiles with both `solc` (EVM bytecode → `codegen/evm/`) and `resolc` (PVM bytecode → `codegen/pvm/`)
- `--solcOnly`: skip resolc compilation (faster, only EVM bytecode)

Output goes to `codegen/abi/`, `codegen/evm/`, and `codegen/pvm/`.
