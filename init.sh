#!/bin/sh

chain=$1
url=$2
tests=$3

total_tests=0
total_passed=0
total_failed=0

LOG_DIR="./test-logs"
mkdir -p $LOG_DIR
mkdir -p "./output-logs"

run_matter_labs_tests() {
  echo "Running Matter Labs EVM Tests" &&
    cd ./matter-labs-tests/contracts &&
    yarn install &&
    git submodule update --init --recursive &&
    TEST_LOG="../../$LOG_DIR/matter-labs-tests.log" &&
    if [ "$USE_REVIVE" = "true"]; then
      npx hardhat compile --config ../config/matter-labs/revive.config.ts
    else
      npx hardhat compile --config ../config/matter-labs/${HARDHAT_CONFIG_NAME}
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

  yarn install && echo "Running Smart Contract V3 Tests"

  case "$USE_REVIVE" in
    true)
      npx hardhat compile --config ./config/general/revive.config.ts
      ;;
    *)
      npx hardhat compile --config ./config/general/${HARDHAT_CONFIG_NAME}
      ;;
  esac

  npx hardhat test | tee "$LOG_DIR/smart-contract-v3-tests.log"
  parse_hardhat_test_results "$LOG_DIR/smart-contract-v3-tests.log"

  cd ./v3-core/ && yarn install

  case "$USE_REVIVE" in
    true)
      npx hardhat compile --config ../config/v3-core/revive.config.ts
      ;;
    *)
      npx hardhat compile --config ../config/v3-core/${HARDHAT_CONFIG_NAME}
      ;;
  esac

  yarn test | tee "../$LOG_DIR/v3-core-tests.log"
  parse_hardhat_test_results "../$LOG_DIR/v3-core-tests.log"

  echo "Running Smart Contract Periphery Tests"
  cd ../v3-periphery/ && yarn install

  case "$USE_REVIVE" in
    true)
      npx hardhat compile --config ../config/v3-periphery/revive.config.ts
      ;;
    *)
      npx hardhat compile --config ../config/v3-periphery/${HARDHAT_CONFIG_NAME}
      ;;
  esac

  yarn test | tee "../$LOG_DIR/v3-periphery-tests.log"
  parse_hardhat_test_results "../$LOG_DIR/v3-periphery-tests.log"

  case "$USE_REVIVE" in
    false)
      echo "Running Smart Contract CCTP Tests" &&
      cd ../evm-cctp-contracts/ &&
      git submodule update --init --recursive &&
      yarn install &&
      forge test --rpc-url $NETWORK_URL --no-match-test "testReceiveMessage_succeedsWithNonzeroDestinationCaller|testReplaceMessage_succeeds|testReplaceMessage_succeedsButFailsToReserveNonceInReceiveMessage|testSetMaxMessageBodySize|testDepositForBurnWithCaller_returnsNonzeroNonce|testDepositForBurnWithCaller_succeeds|testHandleReceiveMessage_succeedsForMint" | tee "../$LOG_DIR/evm-cctp-tests.log"
      parse_forge_test_results "../$LOG_DIR/evm-cctp-tests.log"
      ;;
    *)
      ;;
  esac

  echo "Smart Contracts Test Run Complete"
}


run_matter_labs_and_then_smart_contracts_tests() {
  echo "Running Matter Labs EVM Tests" &&
  cd ./matter-labs-tests/ &&
  yarn install

  case "$USE_REVIVE" in
    true)
      npx hardhat compile --config ../config/matter-labs/revive.config.ts
      ;;
    *)
      npx hardhat compile --config ../config/matter-labs/${HARDHAT_CONFIG_NAME}
      ;;
  esac

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

  echo "Running Smart Contract Tests"

  case "$USE_REVIVE" in
    true)
      npx hardhat compile --config ./config/general/revive.config.ts
      ;;
    *)
      npx hardhat compile --config ./config/general/${HARDHAT_CONFIG_NAME}
      ;;
  esac

  npx hardhat test | tee "$LOG_DIR/smart-contract-v3-tests.log"
  parse_hardhat_test_results "$LOG_DIR/smart-contract-v3-tests.log"

  cd ./v3-core/ &&
  yarn install

  case "$USE_REVIVE" in
    true)
      npx hardhat compile --config ../config/v3-core/revive.config.ts
      ;;
    *)
      npx hardhat compile --config ../config/v3-core/${HARDHAT_CONFIG_NAME}
      ;;
  esac

  yarn test | tee "../$LOG_DIR/v3-core-tests.log"
  parse_hardhat_test_results "../$LOG_DIR/v3-core-tests.log"

  echo "Running Smart Contract Periphery Tests"

  cd ../v3-periphery/ &&
  yarn install

  case "$USE_REVIVE" in
    true)
      npx hardhat compile --config ../config/v3-periphery/revive.config.ts
      ;;
    *)
      npx hardhat compile --config ../config/v3-periphery/${HARDHAT_CONFIG_NAME}
      ;;
  esac

  yarn test | tee "../$LOG_DIR/v3-periphery-tests.log"
  parse_hardhat_test_results "../$LOG_DIR/v3-periphery-tests.log"

  case "$USE_REVIVE" in
    false)
      echo "Running Smart Contract CCTP Tests" &&
      cd ../evm-cctp-contracts/ &&
      git submodule update --init --recursive &&
      yarn install &&
      forge build &&
      forge test --rpc-url $NETWORK_URL --no-match-test "testReceiveMessage_succeedsWithNonzeroDestinationCaller|testReplaceMessage_succeeds|testReplaceMessage_succeedsButFailsToReserveNonceInReceiveMessage|testSetMaxMessageBodySize|testDepositForBurnWithCaller_returnsNonzeroNonce|testDepositForBurnWithCaller_succeeds|testHandleReceiveMessage_succeedsForMint" | tee "../$LOG_DIR/evm-cctp-tests.log"
      parse_forge_test_results "../$LOG_DIR/evm-cctp-tests.log"
      ;;
    *)
      ;;
  esac

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
  export NETWORK_URL="http://localhost:8000"
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
  fi
  ;;
*)
  export HARDHAT_CONFIG_NAME="ethereum.config.ts"
  export USE_REVIVE="false"
  export NETWORK_URL="https://ethereum-rpc.publicnode.com"
  ;;
esac

echo $chain

case "$chain" in
  --ethereum)
    echo "Starting Geth Ethereum Node"
    ./networks/ethereum/build/bin/geth --datadir ./networks/ethereum/node1 init ./networks/ethereum/genesis.json && \
      ./networks/ethereum/build/bin/geth --datadir ./networks/ethereum/node1 --syncmode "full" \
      --port 30304 --http --http.addr "localhost" --http.port 8545 --http.corsdomain="*" \
      --networkid 2345 --allow-insecure-unlock --authrpc.port 8553 &
    sleep 10
    ;;

  --acala)
    echo "Starting Chopsticks instance"
    yarn add @acala-network/chopsticks@latest &&
      npx @acala-network/chopsticks@latest --endpoint=wss://acala-rpc-2.aca-api.network/ws > ./output-logs/chopsticks-output.log 2>&1 &
    echo "Waiting for the Chopsticks to start on ws://[::]:8000..."

    while ! grep -q "app: " ./output-logs/chopsticks-output.log; do
      sleep 1
    done

    echo "Chopsticks instance now running on ws://[::]:8000."

    echo "Starting Eth RPC Adapter instance"
    yarn add @acala-network/eth-rpc-adapter@latest &&
      npx @acala-network/eth-rpc-adapter --endpoint ws://localhost:8000 > ./output-logs/acala-eth-adapter-output.log 2>&1 &
    echo "Waiting for the eth-rpc-adapter to start on port 8545..."

    while ! grep -q "🚀 SERVER STARTED 🚀" ./output-logs/acala-eth-adapter-output.log; do
      sleep 1
    done

    echo "The eth-rpc-adapter is now running on ws://[::]:8545."
    ;;

  --astar)
    echo "Starting Chopsticks instance"
    yarn add @acala-network/chopsticks@latest &&
      npx @acala-network/chopsticks@latest --endpoint=wss://rpc.astar.network > ./output-logs/chopsticks-output.log 2>&1 &
    echo "Waiting for the Chopsticks to start on ws://[::]:8000..."

    while ! grep -q "app: " ./output-logs/chopsticks-output.log; do
      sleep 1
    done

    echo "Chopsticks instance now running on ws://[::]:8000."
    ;;

  --kitchensink)
    echo "Starting Kitchensink Node"
    RUST_LOG="error,evm=debug,sc_rpc_server=info,runtime::revive=debug" ./networks/westend/substrate-node --dev > ./output-logs/chopsticks-output.log 2>&1 &
    echo "Waiting for the Chopsticks to start on ws://[::]:8000..."

    while ! grep -q "app: " ./output-logs/chopsticks-output.log; do
      sleep 1
    done

    echo "Chopsticks instance now running on ws://[::]:8000."

    echo "Starting Eth RPC Adapter"
    RUST_LOG="info,eth-rpc=debug" ./networks/westend/eth-rpc --node-rpc-url ws://127.0.0.1:8000 --dev > ./output-logs/chopsticks-output.log 2>&1 &
    sleep 15
    ;;

  --westend)
    echo "Starting Chopsticks instance"
    yarn add @acala-network/chopsticks@latest &&
      npx @acala-network/chopsticks@latest --endpoint=wss://asset-hub-westend-rpc.dwellir.com > ./output-logs/chopsticks-output.log 2>&1 &
    echo "Waiting for the Chopsticks to start on ws://[::]:8000..."

    while ! grep -q "app: " ./output-logs/chopsticks-output.log; do
      sleep 1
    done

    echo "Chopsticks instance now running on ws://[::]:8000."
    echo "Starting Eth RPC Adapter"
    RUST_LOG="info,eth-rpc=debug" ./networks/westend/eth-rpc --node-rpc-url ws://127.0.0.1:8000 --dev > ./output-logs/revive-rpc-output.log 2>&1 &
    sleep 15
    ;;

  *)
    echo "Unknown chain: $chain"
    ;;
esac

case "$chain" in
  --ethereum)
    case "$tests" in
      --matter-labs)
        run_matter_labs_tests
        sleep 1
        kill -9 $(lsof -t -i:30304)
        echo "Geth Ethereum Node Stopped"
        ;;
      --smart-contracts)
        run_smart_contracts_tests
        sleep 1
        kill -9 $(lsof -t -i:30304)
        echo "Geth Ethereum Node Stopped"
        ;;
      *)
        run_matter_labs_and_then_smart_contracts_tests
        sleep 1
        kill -9 $(lsof -t -i:30304)
        echo "Geth Ethereum Node Stopped"
        ;;
    esac
    ;;
    
  --acala)
    case "$tests" in
      --matter-labs)
        run_matter_labs_tests
        sleep 1
        kill -9 $(lsof -t -i:8545)
        echo "Eth RPC Adapter Instance Stopped"
        kill -9 $(lsof -t -i:8000)
        echo "Chopsticks Instance Stopped"
        ;;
      --smart-contracts)
        run_smart_contracts_tests
        sleep 1
        kill -9 $(lsof -t -i:8545)
        echo "Eth RPC Adapter Instance Stopped"
        kill -9 $(lsof -t -i:8000)
        echo "Chopsticks Instance Stopped"
        ;;
      *)
        run_matter_labs_and_then_smart_contracts_tests
        sleep 1
        kill -9 $(lsof -t -i:8545)
        echo "Eth RPC Adapter Instance Stopped"
        kill -9 $(lsof -t -i:8000)
        echo "Chopsticks Instance Stopped"
        ;;
    esac
    ;;
    
  --astar)
    case "$tests" in
      --matter-labs)
        run_matter_labs_tests
        sleep 1
        kill -9 $(lsof -t -i:800)
        echo "Chopsticks Instance Stopped"
        ;;
      --smart-contracts)
        run_smart_contracts_tests
        sleep 1
        kill -9 $(lsof -t -i:8000)
        echo "Chopsticks Instance Stopped"
        ;;
      *)
        run_matter_labs_and_then_smart_contracts_tests
        sleep 1
        kill -9 $(lsof -t -i:8000)
        echo "Chopsticks Instance Stopped"
        ;;
    esac
    ;;
    
  --kitchensink)
    case "$tests" in
      --matter-labs)
        run_matter_labs_tests
        sleep 1
        kill -9 $(lsof -t -i:8545)
        echo "Eth RPC Adapter Instance Stopped"
        kill -9 $(lsof -t -i:9944)
        echo "Kitchensink Instance Stopped"
        ;;
      --smart-contracts)
        run_smart_contracts_tests
        sleep 1
        kill -9 $(lsof -t -i:8545)
        echo "Eth RPC Adapter Instance Stopped"
        kill -9 $(lsof -t -i:9944)
        echo "Kitchensink Instance Stopped"
        ;;
      *)
        run_matter_labs_and_then_smart_contracts_tests
        sleep 1
        kill -9 $(lsof -t -i:8545)
        echo "Eth RPC Adapter Instance Stopped"
        kill -9 $(lsof -t -i:9944)
        echo "Kitchensink Instance Stopped"
        ;;
    esac
    ;;
    
  --westend)
    case "$tests" in
      --matter-labs)
        run_matter_labs_tests
        sleep 1
        kill -9 $(lsof -t -i:8545)
        echo "Eth RPC Adapter Instance Stopped"
        kill -9 $(lsof -t -i:8000)
        echo "Chopsticks Instance Stopped"
        ;;
      --smart-contracts)
        run_smart_contracts_tests
        sleep 1
        kill -9 $(lsof -t -i:8545)
        echo "Eth RPC Adapter Instance Stopped"
        kill -9 $(lsof -t -i:8000)
        echo "Chopsticks Instance Stopped"
        ;;
      *)
        run_matter_labs_and_then_smart_contracts_tests
        sleep 1
        kill -9 $(lsof -t -i:8545)
        echo "Eth RPC Adapter Instance Stopped"
        kill -9 $(lsof -t -i:8000)
        echo "Chopsticks Instance Stopped"
        ;;
    esac
    ;;
    
  *)
    case "$tests" in
      --matter-labs)
        run_matter_labs_tests
        ;;
      --smart-contracts)
        run_smart_contracts_tests
        ;;
      *)
        run_matter_labs_and_then_smart_contracts_tests
        ;;
    esac
    ;;
esac


echo "Final Test Summary:"
echo "Total: $total_tests | Passed: $total_passed | Failed: $total_failed"
