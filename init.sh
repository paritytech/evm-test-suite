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
  yarn install &&
    echo "Running Matter Labs EVM Tests" &&
    cd ./matter-labs-tests/contracts &&
    git submodule update --init --recursive &&
    TEST_LOG="../../$LOG_DIR/matter-labs-tests.log" &&
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
    npx hardhat compile &&
    npx hardhat test | tee "$LOG_DIR/smart-contract-v3-tests.log"
  parse_hardhat_test_results "$LOG_DIR/smart-contract-v3-tests.log"

  cd ./v3-core/ &&
    yarn install &&
    yarn compile &&
    yarn test | tee "../$LOG_DIR/v3-core-tests.log"
  parse_hardhat_test_results "../$LOG_DIR/v3-core-tests.log"

  echo "Running Smart Contract Periphery Tests" &&
    cd ../v3-periphery/ &&
    yarn install &&
    yarn compile &&
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
  yarn install &&
    echo "Running Matter Labs EVM Tests" &&
    cd ./matter-labs-tests/ &&
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
    npx hardhat compile &&
    npx hardhat test | tee "$LOG_DIR/smart-contract-v3-tests.log"
  parse_hardhat_test_results "$LOG_DIR/smart-contract-v3-tests.log"

  cd ./v3-core/ &&
    yarn install &&
    yarn compile &&
    yarn test | tee "../$LOG_DIR/v3-core-tests.log"
  parse_hardhat_test_results "../$LOG_DIR/v3-core-tests.log"

  echo "Running Smart Contract Periphery Tests" &&
    cd ../v3-periphery/ &&
    yarn install &&
    yarn compile &&
    yarn test | tee "../$LOG_DIR/v3-periphery-tests.log"
  parse_hardhat_test_results "../$LOG_DIR/v3-periphery-tests.log"

  echo "Running Smart Contract CCTP Tests" &&
    cd ../evm-cctp-contracts/ &&
    git submodule update --init --recursive &&
    yarn install &&
    forge build &&
    forge test --rpc-url $NETWORK_URL --no-match-test "testReceiveMessage_succeedsWithNonzeroDestinationCaller|testReplaceMessage_succeeds|testReplaceMessage_succeedsButFailsToReserveNonceInReceiveMessage|testSetMaxMessageBodySize|testDepositForBurnWithCaller_returnsNonzeroNonce|testDepositForBurnWithCaller_succeeds|testHandleReceiveMessage_succeedsForMint" | tee "../$LOG_DIR/evm-cctp-tests.log"
  parse_forge_test_results "../$LOG_DIR/evm-cctp-tests.log"

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
  export NETWORK_URL="https://eth-rpc-acala.aca-api.network"
  ;;
--ethereum)
  export NETWORK_URL="http://localhost:8545"
  ;;
--moonbeam)
  export NETWORK_URL="https://moonbeam.public.blastapi.io"
  ;;
--astar)
  export NETWORK_URL="https://rpc.astar.network"
  ;;
--polygon)
  export NETWORK_URL="https://polygon-mainnet.infura.io/v3/${PRIVATE_KEY}"
  ;;
--westend)
  export NETWORK_URL="https://westend-asset-hub-eth-rpc.polkadot.io/"
  ;;
--arbitrum)
  export NETWORK_URL="https://arbitrum-mainnet.infura.io/v3/${PRIVATE_KEY}"
  ;;
--endpoint | -e)
  export NETWORK_URL="$2"
  ;;
*)
  export NETWORK_URL="https://ethereum-rpc.publicnode.com"
  ;;
esac

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

echo "Final Test Summary:"
echo "Total: $total_tests | Passed: $total_passed | Failed: $total_failed"
