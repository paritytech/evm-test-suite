---
description: Build Solidity contracts for EVM and PVM
allowed-tools: Bash(deno:*)
argument-hint: [--solcOnly]
---

Build the Solidity contracts in `contracts/` directory, generating ABI files and bytecode.

User provided these flags: `$ARGUMENTS`

```
cd /home/pg/github/evm-test-suite && deno task build $ARGUMENTS
```

- Default: compiles with both `solc` (EVM bytecode → `codegen/evm/`) and `resolc` (PVM bytecode → `codegen/pvm/`)
- `--solcOnly`: skip resolc compilation (faster, only EVM bytecode)

Output goes to `codegen/abi/`, `codegen/evm/`, and `codegen/pvm/`.
