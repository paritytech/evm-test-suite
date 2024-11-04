#!/bin/sh

case "$1" in
  --acala)
    export NETWORK_URL="http://localhost:8545"
    export TEST_CASE="$2"
    ;;
  --ethereum)
    export NETWORK_URL="https://ethereum-rpc.publicnode.com"
    export TEST_CASE="$2"
    ;;
  --moonbeam)
    export NETWORK_URL="https://moonbeam.public.blastapi.io"
    export TEST_CASE="$2"
    ;;
  --astar)
    export NETWORK_URL="https://rpc.astar.network"
    export TEST_CASE="$2"
    ;;
  --polygon)
    export NETWORK_URL="https://polygon-amoy-bor-rpc.publicnode.com"
    export TEST_CASE="$2"
    ;;
  --westend)
    export NETWORK_URL="https://westend-asset-hub-eth-rpc.polkadot.io/"
    export TEST_CASE="$2"
    ;;
  --endpoint | -e)
    export NETWORK_URL="$2"
    export TEST_CASE="$3"
    ;;
  *)
    export NETWORK_URL="https://ethereum-rpc.publicnode.com"
    export TEST_CASE="$2"
    ;;
esac

if [ "$1" = '--acala' ]; then
  npx @acala-network/eth-rpc-adapter -e wss://acala-rpc-2.aca-api.network/ws &
  sleep 10
fi

if [ "$TEST_CASE" = '--matter-labs' ]; then
  cd ./matter-labs-tests/ &&
  npx hardhat test ./test/MatterLabsTests.ts
elif [ "$TEST_CASE" = '--smart-contracts' ]; then
  npx hardhat compile &&
  npx hardhat test &&
  cd ./v3-core/ &&
  yarn install &&
  yarn test &&
  cd ../v3-periphery/ &&
  yarn install &&
  yarn compile &&
  yarn test
else
  npx hardhat compile &&
  npx hardhat test &&
  cd ./v3-core/ &&
  yarn install &&
  yarn test &&
  cd ../v3-periphery/ &&
  yarn install &&
  yarn compile &&
  yarn test &&
  cd ../../matter-labs-tests/ &&
  npx hardhat test ./test/MatterLabsTests.ts
fi
