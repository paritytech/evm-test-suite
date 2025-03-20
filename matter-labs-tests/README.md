# Revive Differential Tests

## Summary

Test Suite for testing PVM compatability with EVM

# .env.example
NODE_COUNT=1
GETH_NODE_BIN_DIR=path_to_local_geth_binary
KITCHEN_SINK_NODE_BIN_DIR=path_to_local_substrate-node_binary
KITCHEN_SINK_ETH_RPC_BIN=path_to_local_substrate-node_eth_rpc

GETH_NODE_PORT=8845
KITCHEN_SINK_NODE_PORT=9944
KITCHEN_SINK_ETH_RPC_PORT=8545
GENESIS_JSON_DIR=path_to_your_genesis.json
CONTRACT_FILTERS=multidimensional,0_topics_0_bytes

# Getting Started

```shell
npm install --force

npm run update-submodule

npm run compile

npm run differential-tests
```
