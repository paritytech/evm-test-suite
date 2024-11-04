#!/bin/sh

chain=$1
tests=$2

run_matter_labs_tests()
{
    echo "Running Matter Labs EVM Tests" &&
    cd ./matter-labs-tests/ &&
    npx hardhat test ./test/MatterLabsTests.ts &&
    
    echo "Test Run Complete"
}

run_smart_contracts_tests()
{
  echo "Running Smart Contract V3 Tests" &&
  npx hardhat compile &&
  npx hardhat test &&
  cd ./v3-core/ &&
  yarn install &&
  yarn test &&

  echo "Running Smart Contract Periphery Tests" &&
  cd ../v3-periphery/ &&
  yarn install &&
  yarn compile &&
  yarn test &&

  echo "Test Run Complete"
}

run_matter_labs_and_then_smart_contracts_tests()
{
    echo "Running Matter Labs EVM Tests" &&
    cd ./matter-labs-tests/ &&
    npx hardhat test ./test/MatterLabsTests.ts &&

    echo "Running Smart Contract V3 Tests" &&
    npx hardhat compile &&
    npx hardhat test &&
    cd ../v3-core/ &&
    yarn install &&
    yarn test &&

    echo "Running Smart Contract Periphery Tests" &&
    cd ../v3-periphery/ &&
    yarn install &&
    yarn compile &&
    yarn test &&

    echo "Test Run Complete"
}


if [ "$chain" = '--acala' ]; then
  export NETWORK_URL="https://eth-rpc-acala.aca-api.network"
elif [ "$chain" = '--ethereum' ]; then
  export NETWORK_URL="http://localhost:8545"
elif [ "$chain" = '--moonbeam' ]; then
  export NETWORK_URL="https://moonbeam.public.blastapi.io"
elif [ "$chain" = '--astar' ]; then
  export NETWORK_URL="https://rpc.astar.network"
elif [ "$chain" = '--polygon' ]; then
  export NETWORK_URL="https://polygon-amoy-bor-rpc.publicnode.com"
else
  export NETWORK_URL="https://ethereum-rpc.publicnode.com"
fi

echo $chain

if [ "$chain" = '--ethereum' ]; then
  echo "Starting Geth Ethereum Node"
  ./networks/ethereum/build/bin/geth --datadir ./networks/ethereum/node1 init ./networks/ethereum/genesis.json && ./networks/ethereum/build/bin/geth --datadir ./networks/ethereum/node1 --syncmode "full" --port 30304 --http --http.addr "localhost" --http.port 8545 --http.corsdomain="*" --networkid 2345 --allow-insecure-unlock --authrpc.port 8553 &
  sleep 10
fi

if [ "$chain" = '--ethereum' ]; then
  if [ "$tests" = '--matter-labs' ]; then 
    run_matter_labs_tests
    sleep 1
    kill -9 $(lsof -t -i:30304)
    echo "Geth Ethereum Node Stopped"
  elif [ "$tests" = '--smart-contracts' ]; then
    run_smart_contracts_tests
    sleep 1
    kill -9 $(lsof -t -i:30304)
    echo "Geth Ethereum Node Stopped"
  else 
    run_matter_labs_and_then_smart_contracts_tests
    sleep 1
    kill -9 $(lsof -t -i:30304)
    echo "Geth Ethereum Node Stopped"
  fi
elif [ "$tests" = '--matter-labs' ]; then
  run_matter_labs_tests
elif [ "$tests" = '--smart-contracts' ]; then
  run_smart_contracts_tests
else
  run_matter_labs_and_then_smart_contracts_tests
fi
