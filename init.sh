#!/bin/sh

chain=$1
url=$2
tests=$3

total_tests=0
total_passed=0
total_failed=0

LOG_DIR="./test-logs"
mkdir -p $LOG_DIR

run_matter_labs_tests() {
    echo "Running Matter Labs EVM Tests" &&
    cd ./matter-labs-tests/contracts &&
    yarn install &&
    git submodule update --init --recursive &&
    TEST_LOG="../../$LOG_DIR/matter-labs-tests.log" &&
    if [ "$USE_REVIVE" = "true"]; then
      npx hardhat compile --config ../config/revive.config.ts 
    else
      npx hardhat compile --config ../config/${HARDHAT_CONFIG_NAME}
    fi
    npx hardhat test ../test/MatterLabsTests.ts | tee "$TEST_LOG"
  parse_hardhat_test_results "../../$LOG_DIR/matter-labs-tests.log"
}

run_smart_contracts_tests() {
  if ! command -v forge >/dev/null 2>&1; then
    echo "Setting Up Foundry..."

    curl -L https://foundry.paradigm.xyz | bash

    case "$SHELL" in
    */bash)
      source ~/.bashrc
      ;;
    */zsh)
      source ~/.zshenv
      ;;
    *)
      echo "Unknown shell: $SHELL"
      ;;
    esac

    foundryup
  else
    echo "Foundry is already installed. Skipping installation."
  fi

  yarn install &&
    echo "Running Smart Contract V3 Tests" &&
    if [ "$USE_REVIVE" = "true"]; then
      npx hardhat compile --config ./config/revive.config.ts 
    else
      npx hardhat compile --config ./config/${HARDHAT_CONFIG_NAME}
    fi
    npx hardhat test | tee "$LOG_DIR/smart-contract-v3-tests.log"
  parse_hardhat_test_results "$LOG_DIR/smart-contract-v3-tests.log"

  cd ./v3-core/ &&
    yarn install &&
    if [ "$USE_REVIVE" = "true"]; then
      npx hardhat compile --config ../config/revive.config.ts 
    else
      npx hardhat compile --config ../config/${HARDHAT_CONFIG_NAME}
    fi
    yarn test | tee "../$LOG_DIR/v3-core-tests.log"
  parse_hardhat_test_results "../$LOG_DIR/v3-core-tests.log"

  echo "Running Smart Contract Periphery Tests" &&
    cd ../v3-periphery/ &&
    yarn install &&
    if [ "$USE_REVIVE" = "true"]; then
      npx hardhat compile --config ../config/revive.config.ts 
    else
      npx hardhat compile --config ../config/${HARDHAT_CONFIG_NAME}
    fi
    yarn test | tee "../$LOG_DIR/v3-periphery-tests.log"
  parse_hardhat_test_results "../$LOG_DIR/v3-periphery-tests.log"

  echo "Running Smart Contract CCTP Tests" &&
    cd ../evm-cctp-contracts/ &&
    git submodule update --init --recursive &&
    yarn install &&
    forge test --rpc-url $NETWORK_URL --no-match-test "testReceiveMessage_succeedsWithNonzeroDestinationCaller|testReplaceMessage_succeeds|testReplaceMessage_succeedsButFailsToReserveNonceInReceiveMessage|testSetMaxMessageBodySize|testDepositForBurnWithCaller_returnsNonzeroNonce|testDepositForBurnWithCaller_succeeds|testHandleReceiveMessage_succeedsForMint" | tee "../$LOG_DIR/evm-cctp-tests.log"
  parse_forge_test_results "../$LOG_DIR/evm-cctp-tests.log"

  echo "Smart Contracts Test Run Complete"
}

run_matter_labs_and_then_smart_contracts_tests() {
    echo "Running Matter Labs EVM Tests" &&
    cd ./matter-labs-tests/ &&
    yarn install &&
    if [ "$USE_REVIVE" = "true"]; then
      npx hardhat compile --config ../config/revive.config.ts 
    else
      npx hardhat compile --config ../config/${HARDHAT_CONFIG_NAME}
    fi
    npx hardhat test ./test/MatterLabsTests.ts | tee "$LOG_DIR/matter-labs-tests.log"
  parse_hardhat_test_results "$LOG_DIR/matter-labs-tests.log"

  cd ..

  if ! command -v forge >/dev/null 2>&1; then
    echo "Setting Up Foundry..."

    curl -L https://foundry.paradigm.xyz | bash

    case "$SHELL" in
    */bash)
      source ~/.bashrc
      ;;
    */zsh)
      source ~/.zshenv
      ;;
    *)
      echo "Unknown shell: $SHELL"
      ;;
    esac

    foundryup
  else
    echo "Foundry is already installed. Skipping installation."
  fi

  echo "Running Smart Contract V3 Tests" &&
    if [ "$USE_REVIVE" = "true"]; then
      npx hardhat compile --config ./revive.config.ts 
    else
      npx hardhat compile      
    fi
    npx hardhat test | tee "$LOG_DIR/smart-contract-v3-tests.log"
  parse_hardhat_test_results "$LOG_DIR/smart-contract-v3-tests.log"

  cd ./v3-core/ &&
    yarn install &&
    if [ "$USE_REVIVE" = "true"]; then
      npx hardhat compile --config ../config/revive.config.ts 
    else
      npx hardhat compile --config ../config/${HARDHAT_CONFIG_NAME}
    fi
    yarn test | tee "../$LOG_DIR/v3-core-tests.log"
  parse_hardhat_test_results "../$LOG_DIR/v3-core-tests.log"

  echo "Running Smart Contract Periphery Tests" &&
    cd ../v3-periphery/ &&
    yarn install &&
    if [ "$USE_REVIVE" = "true"]; then
      npx hardhat compile --config ../config/revive.config.ts 
    else
      npx hardhat compile --config ../config/${HARDHAT_CONFIG_NAME}
    fi
    yarn test | tee "../$LOG_DIR/v3-periphery-tests.log"
  parse_hardhat_test_results "../$LOG_DIR/v3-periphery-tests.log"

  if [ "$USE_REVIVE" = "false"]; then
    echo "Running Smart Contract CCTP Tests" &&
      cd ../evm-cctp-contracts/ &&
      git submodule update --init --recursive &&
      yarn install &&
      forge build &&
      forge test --rpc-url $NETWORK_URL --no-match-test "testReceiveMessage_succeedsWithNonzeroDestinationCaller|testReplaceMessage_succeeds|testReplaceMessage_succeedsButFailsToReserveNonceInReceiveMessage|testSetMaxMessageBodySize|testDepositForBurnWithCaller_returnsNonzeroNonce|testDepositForBurnWithCaller_succeeds|testHandleReceiveMessage_succeedsForMint" | tee "../$LOG_DIR/evm-cctp-tests.log"
    parse_forge_test_results "../$LOG_DIR/evm-cctp-tests.log"
  fi
  
  echo "Test Run Complete"
}

parse_hardhat_test_results() {
  log_file=$1
  passed=$(grep -o '[0-9]\+ passing' "$log_file" | awk '{print $1}')
  failed=$(grep -o '[0-9]\+ failing' "$log_file" | awk '{print $1}')
  
  if [ -z "$passed" ]; then
    passed=0
  fi
  
  if [ -z "$failed" ]; then
    failed=0
  fi
  
  total=$((passed + failed))

  total_passed=$((total_passed + passed))
  total_failed=$((total_failed + failed))
  total_tests=$((total_tests + total))

  echo "Hardhat Test Summary from $log_file:"
  echo "Total: $total | Passed: $passed | Failed: $failed"
}

parse_forge_test_results() {
  log_file=$1
  passed=$(grep -o 'Passed' "$log_file" | wc -l)
  failed=$(grep -o 'Failed' "$log_file" | wc -l)

  if [ -z "$passed" ]; then
    passed=0
  fi
  
  if [ -z "$failed" ]; then
    failed=0
  fi
  
  total=$((passed + failed))

  total_passed=$((total_passed + passed))
  total_failed=$((total_failed + failed))
  total_tests=$((total_tests + total))

  echo "Foundry Test Summary from $log_file:"
  echo "Total: $total | Passed: $passed | Failed: $failed"
}

case "$chain" in
--acala)
  export HARDHAT_CONFIG_NAME="acala.config.ts"
  export USE_REVIVE="false"
  export NETWORK_URL="http://localhost:8545"
  ;;
--ethereum)
  export HARDHAT_CONFIG_NAME="ethereum.config.ts"
  export USE_REVIVE="false"
  export NETWORK_URL="http://localhost:8545"
  ;;
--moonbeam)
  export HARDHAT_CONFIG_NAME="moonbeam.config.ts"
  export USE_REVIVE="false"
  export NETWORK_URL="https://moonbeam.public.blastapi.io"
  ;;
--astar)
  export HARDHAT_CONFIG_NAME="astar.config.ts"
  export USE_REVIVE="false"
  export NETWORK_URL="http://localhost:9944"
  ;;
--polygon)
  export HARDHAT_CONFIG_NAME="polygon.config.ts"
  export USE_REVIVE="false"
  export NETWORK_URL="https://polygon-mainnet.infura.io/v3/${PRIVATE_KEY}"
  ;;
--arbitrum)
  export HARDHAT_CONFIG_NAME="arbitrum.config.ts"
  export USE_REVIVE="false"
  export NETWORK_URL="https://arbitrum-mainnet.infura.io/v3/${PRIVATE_KEY}"
  ;;
  --kitchensink)
  export HARDHAT_CONFIG_NAME="revive.config.ts"
  export USE_REVIVE="true"
  export NETWORK_URL="http://localhost:8545"
  ;;
  --westend)
  export HARDHAT_CONFIG_NAME="revive.config.ts"
  export USE_REVIVE="true"
  export NETWORK_URL="http://localhost:8545"
  ;;
--endpoint | -e)
  if [ "${USER_REVIVE}" = "true" ]; then
    export HARDHAT_CONFIG_NAME="revive.config.ts"
  else
    export HARDHAT_CONFIG_NAME="hardhat.config.ts"
  ;;
*)
  export HARDHAT_CONFIG_NAME="ethereum.config.ts"
  export USE_REVIVE="false"
  export NETWORK_URL="https://ethereum-rpc.publicnode.com"
  ;;
esac

echo $chain

if [ "$chain" = '--ethereum' ]; then
  echo "Starting Geth Ethereum Node"
  ./networks/ethereum/build/bin/geth --datadir ./networks/ethereum/node1 init ./networks/ethereum/genesis.json && ./networks/ethereum/build/bin/geth --datadir ./networks/ethereum/node1 --syncmode "full" --port 30304 --http --http.addr "localhost" --http.port 8545 --http.corsdomain="*" --networkid 2345 --allow-insecure-unlock --authrpc.port 8553 &
  sleep 10
elif ["$chain" = '--acala']; then
  echo "Starting Chopsticks instance"
  yarn add @acala-network/chopsticks@latest &&
  npx @acala-network/chopsticks@latest --endpoint=wss://acala-rpc-2.aca-api.network/ws &
  sleep 10
  echo "Starting Eth RPC Adapter instance"
  yarn add @acala-network/eth-rpc-adapter@latest &&
  npx @acala-network/eth-rpc-adapter &
  sleep 10
elif ["$chain" = '--astar']; then
  echo "Starting Chopsticks instance"
  yarn add @acala-network/chopsticks@latest &&
  npx @acala-network/chopsticks@latest --endpoint=wss://rpc.astar.network &
  sleep 10
elif ["$chain" = '--kitchensink']; then
  echo "Starting Kitchensink Node"
  RUST_LOG="error,evm=debug,sc_rpc_server=info,runtime::revive=debug" ./networks/westend/substrate-node --dev &
  sleep 10
  echo "Starting Eth RPC Adapter"
  RUST_LOG="info,eth-rpc=debug" ./networks/westend/eth-rpc --dev &
  sleep 10
elif ["$chain" = '--westend']; then
  echo "Starting Chopsticks instance"
  yarn add @acala-network/chopsticks@latest &&
  npx @acala-network/chopsticks@latest --endpoint=wss://asset-hub-westend-rpc.dwellir.com &
  sleep 10
  echo "Starting Eth RPC Adapter"
  RUST_LOG="info,eth-rpc=debug" ./networks/westend/eth-rpc --dev &
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
elif [ "$chain" = '--acala' ]; then
  if [ "$tests" = '--matter-labs' ]; then
    run_matter_labs_tests
    sleep 1
    kill -9 $(lsof -t -i:8545)
    echo "Eth RPC Adapter Instance Stopped"
    kill -9 $(lsof -t -i:9944)
    echo "Chopsticks Instance Stopped"
  elif [ "$tests" = '--smart-contracts' ]; then
    run_smart_contracts_tests
    sleep 1
    kill -9 $(lsof -t -i:8545)
    echo "Eth RPC Adapter Instance Stopped"
    kill -9 $(lsof -t -i:9944)
    echo "Chopsticks Instance Stopped"
  else
    run_matter_labs_and_then_smart_contracts_tests
    sleep 1
    kill -9 $(lsof -t -i:8545)
    echo "Eth RPC Adapter Instance Stopped"
    kill -9 $(lsof -t -i:9944)
    echo "Chopsticks Instance Stopped"
  fi
elif [ "$chain" = '--astar' ]; then
  if [ "$tests" = '--matter-labs' ]; then
    run_matter_labs_tests
    sleep 1
    kill -9 $(lsof -t -i:9944)
    echo "Chopsticks Instance Stopped"
  elif [ "$tests" = '--smart-contracts' ]; then
    run_smart_contracts_tests
    sleep 1
    kill -9 $(lsof -t -i:9944)
    echo "Chopsticks Instance Stopped"
  else
    run_matter_labs_and_then_smart_contracts_tests
    sleep 1
    kill -9 $(lsof -t -i:9944)
    echo "Chopsticks Instance Stopped"
  fi
elif [ "$chain" = '--kitchensink' ]; then
  if [ "$tests" = '--matter-labs' ]; then
    run_matter_labs_tests
    sleep 1
    kill -9 $(lsof -t -i:8545)
    echo "Eth RPC Adapter Instance Stopped"
    kill -9 $(lsof -t -i:9944)
    echo "Kitchensink Instance Stopped"
  elif [ "$tests" = '--smart-contracts' ]; then
    run_smart_contracts_tests
    sleep 1
    kill -9 $(lsof -t -i:8545)
    echo "Eth RPC Adapter Instance Stopped"
    kill -9 $(lsof -t -i:9944)
    echo "Kitchensink Instance Stopped"
  else
    run_matter_labs_and_then_smart_contracts_tests
    sleep 1
    kill -9 $(lsof -t -i:8545)
    echo "Eth RPC Adapter Instance Stopped"
    kill -9 $(lsof -t -i:9944)
    echo "Kitchensink Instance Stopped"
elif [ "$chain" = '--westend' ]; then
  if [ "$tests" = '--matter-labs' ]; then
    run_matter_labs_tests
    sleep 1
    kill -9 $(lsof -t -i:8545)
    echo "Eth RPC Adapter Instance Stopped"
    kill -9 $(lsof -t -i:9944)
    echo "Chopsticks Instance Stopped"
  elif [ "$tests" = '--smart-contracts' ]; then
    run_smart_contracts_tests
    sleep 1
    kill -9 $(lsof -t -i:8545)
    echo "Eth RPC Adapter Instance Stopped"
    kill -9 $(lsof -t -i:9944)
    echo "Chopsticks Instance Stopped"
  else
    run_matter_labs_and_then_smart_contracts_tests
    sleep 1
    kill -9 $(lsof -t -i:8545)
    echo "Eth RPC Adapter Instance Stopped"
    kill -9 $(lsof -t -i:9944)
    echo "Chopsticks Instance Stopped"
elif [ "$tests" = '--matter-labs' ]; then
  run_matter_labs_tests
elif [ "$tests" = '--smart-contracts' ]; then
  run_smart_contracts_tests
else
  run_matter_labs_and_then_smart_contracts_tests
fi

echo "Final Test Summary:"
echo "Total: $total_tests | Passed: $total_passed | Failed: $total_failed"
