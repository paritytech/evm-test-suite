#!/bin/sh

chain=$1
url=$2
tests=$3

case "$chain" in
  --acala)
    export NETWORK_URL="https://eth-rpc-acala.aca-api.network"
    ;;
  --ethereum)
    export NETWORK_URL="https://ethereum-rpc.publicnode.com"
    ;;
  --moonbeam)
    export NETWORK_URL="https://moonbeam.public.blastapi.io"
    ;;
  --astar)
    export NETWORK_URL="https://rpc.astar.network"
    ;;
  --polygon)
    export NETWORK_URL="https://polygon-amoy-bor-rpc.publicnode.com"
    ;;
  --westend)
    export NETWORK_URL="https://westend-asset-hub-eth-rpc.polkadot.io/"
    ;;
  --endpoint | -e)
    export NETWORK_URL="$2"
    ;;
  *)
    export NETWORK_URL="https://ethereum-rpc.publicnode.com"
    ;;
esac

if [ "$tests" = '--matter-labs' ]; then
  cd ./matter-labs-tests/ &&
  npx hardhat test ./test/MatterLabsTests.ts
elif [ "$tests" = '--smart-contracts' ]; then
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
