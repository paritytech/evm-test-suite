#!/bin/sh

set -eux

chain=$1
url=$2
tests=$3
forking="${4:-false}"
nodePath="${5:---}"
adapterPath="${6:---}"
compilerPath="${7:---}"
testFilter="${8:---}"
verboseLogging="${9:---}"

total_tests=0
total_passed=0
total_failed=0

LOG_DIR="./test-logs"
mkdir -p $LOG_DIR
mkdir -p "./output-logs"

OS_NAME=$(uname)

case "$OS_NAME" in
"Darwin")
  export NETWORK_DIR="macOS"
  export GETH_DIR=${PWD}/networks/ethereum/build/bin/${NETWORK_DIR}/geth
  chmod +x ${GETH_DIR}
  ;;
"Linux")
  export NETWORK_DIR="linux"
  export GETH_DIR=${PWD}/networks/ethereum/build/bin/${NETWORK_DIR}/geth
  chmod +x ${GETH_DIR}
  ;;
*)
  export NETWORK_DIR="linux"
  export GETH_DIR=${PWD}/networks/ethereum/build/bin/${NETWORK_DIR}/geth
  chmod +x ${GETH_DIR}
  ;;
esac

run_matter_labs_tests() {
  npm i &&
    echo "Running Matter Labs EVM Tests" &&
    cd ./matter-labs-tests &&
    npm i --force &&
    git submodule update --init --recursive &&
    TEST_LOG="../$LOG_DIR/matter-labs-tests.log" &&
    case "$USE_REVIVE" in
    true)
      npx hardhat compile --config ./${HARDHAT_CONFIG_NAME}.ts
      npx hardhat test --config ./${HARDHAT_CONFIG_NAME}.ts --no-compile --network ${NETWORK_NAME} | tee ".$LOG_DIR/matter-labs-tests.log"
      ;;
    *)
      npx hardhat compile --config ./${HARDHAT_CONFIG_NAME}.ts
      npx hardhat test --config ./${HARDHAT_CONFIG_NAME}.ts --no-compile | tee ".$LOG_DIR/matter-labs-tests.log"
      ;;
    esac
  parse_hardhat_test_results "../test-logs/matter-labs-tests.log"
}

# run_open_zeppelin_tests() {
#   npm i &&
#     echo "Running Open Zeppelin EVM Tests" &&
#     cd ./openzeppelin-contracts &&
#     npm i --force &&
#     git submodule update --init --recursive &&
#     TEST_LOG="../$LOG_DIR/open-zeppelin-tests.log" &&
#     case "$USE_REVIVE" in
#     true)
#       npx hardhat compile --config ./${HARDHAT_CONFIG_NAME}.js
#       npx hardhat test --config ./${HARDHAT_CONFIG_NAME}.js --no-compile --network ${NETWORK_NAME} | tee ".$LOG_DIR/open-zeppelin-tests.log"
#       ;;
#     *)
#       npx hardhat compile --config ./${HARDHAT_CONFIG_NAME}.js
#       npx hardhat test --config ./${HARDHAT_CONFIG_NAME}.js --no-compile | tee ".$LOG_DIR/open-zeppelin-tests.log"
#       ;;
#     esac
#   parse_hardhat_test_results "../test-logs/open-zeppelin-tests.log"
# }

run_geth_diff_tests() {
  echo "Running Geth Differential Tests" &&
    cd ./geth-diff &&
    npm install &&
    npm run build &&
    START_GETH=true START_SUBSTRATE_NODE=true START_ETH_RPC=true bun test --timeout 30000 >".$LOG_DIR/geth-diff-tests.log" 2>&1
  parse_geth_diff_test_results "../test-logs/geth-diff-tests.log"
}

run_all_tests() {
  npm i &&
    echo "Running Matter Labs EVM Tests" &&
    cd ./matter-labs-tests &&
    npm i --force &&
    case "$USE_REVIVE" in
    true)
      npx hardhat compile --config ./${HARDHAT_CONFIG_NAME}.ts
      npx hardhat test --config ./${HARDHAT_CONFIG_NAME}.ts --no-compile --network ${NETWORK_NAME} | tee ".$LOG_DIR/matter-labs-tests.log"
      ;;
    *)
      npx hardhat compile --config ./${HARDHAT_CONFIG_NAME}.ts
      npx hardhat test --config ./${HARDHAT_CONFIG_NAME}.ts --no-compile | tee "../$LOG_DIR/matter-labs-tests.log"
      ;;
    esac
  parse_hardhat_test_results "../$LOG_DIR/matter-labs-tests.log"

  cd ..

  # echo "Running Open Zeppelin Tests"
  # cd ./openzeppelin-contracts &&
  #   npm i --force &&
  #   case "$USE_REVIVE" in
  #   true)
  #     npx hardhat compile --config ./${HARDHAT_CONFIG_NAME}.js
  #     npx hardhat test --config ./${HARDHAT_CONFIG_NAME}.js --no-compile --network ${NETWORK_NAME} | tee ".$LOG_DIR/open-zeppelin-tests.log"
  #     ;;
  #   *)
  #     npx hardhat compile --config ./${HARDHAT_CONFIG_NAME}.js
  #     npx hardhat test --config ./${HARDHAT_CONFIG_NAME}.js --no-compile | tee ".$LOG_DIR/open-zeppelin-tests.log"
  #     ;;
  #   esac
  # parse_hardhat_test_results ".$LOG_DIR/open-zeppelin-tests.log"

  # cd ..

  echo "Running Geth Differential Tests" &&
    cd ./geth-diff &&
    npm install &&
    npm run build &&
    START_GETH=true START_SUBSTRATE_NODE=true START_ETH_RPC=true bun test --timeout 30000 | tee ".$LOG_DIR/geth-diff-tests.log"
  parse_geth_diff_test_results "../test-logs/geth-diff-tests.log"

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

parse_geth_diff_test_results() {
  log_file=$1
  passed=$(grep -o '[0-9]\+ pass' "$log_file" | awk '{print $1}')
  failed=$(grep -o '[0-9]\+ fail' "$log_file" | awk '{print $1}')

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

case "$chain" in
--acala)
  export HARDHAT_CONFIG_NAME="hardhat.evm.config"
  export USE_REVIVE="false"
  export NETWORK_URL="http://localhost:8545"
  export CHAIN_ID=787
  export NETWORK_NAME="acala"
  export TEST_FILTER=$testFilter
  export VERBOSE_LOGGING=$verboseLogging
  ;;
--ethereum)
  export HARDHAT_CONFIG_NAME="hardhat.evm.config"
  export USE_REVIVE="false"
  export NETWORK_URL="http://localhost:8545"
  export CHAIN_ID=1
  export NETWORK_NAME="ethereum"
  export TEST_FILTER=$testFilter
  export VERBOSE_LOGGING=$verboseLogging
  export START_GETH="true"
  export NODE_PATH=$nodePath
  export ADAPTER_PATH=$adapterPath
  ;;
--moonbeam)
  export HARDHAT_CONFIG_NAME="hardhat.evm.config"
  export USE_REVIVE="false"
  export NETWORK_URL="https://moonbeam.public.blastapi.io"
  export CHAIN_ID=1284
  export NETWORK_NAME="moonbeam"
  export TEST_FILTER=$testFilter
  export VERBOSE_LOGGING=$verboseLogging
  ;;
--astar)
  export HARDHAT_CONFIG_NAME="hardhat.evm.config"
  export USE_REVIVE="false"
  export NETWORK_URL="http://localhost:8000"
  export CHAIN_ID=592
  export NETWORK_NAME="astar"
  export TEST_FILTER=$testFilter
  export VERBOSE_LOGGING=$verboseLogging
  ;;
--polygon)
  export HARDHAT_CONFIG_NAME="hardhat.evm.config"
  export USE_REVIVE="false"
  export NETWORK_URL="https://polygon-mainnet.infura.io/v3/${PRIVATE_KEY}"
  export CHAIN_ID=137
  export NETWORK_NAME="polygon"
  export TEST_FILTER=$testFilter
  export VERBOSE_LOGGING=$verboseLogging
  ;;
--arbitrum)
  export HARDHAT_CONFIG_NAME="hardhat.evm.config"
  export USE_REVIVE="false"
  export NETWORK_URL="https://arbitrum-mainnet.infura.io/v3/${PRIVATE_KEY}"
  export CHAIN_ID=42161
  export NETWORK_NAME="arbitrum"
  export TEST_FILTER=$testFilter
  export VERBOSE_LOGGING=$verboseLogging
  ;;
--kitchensink)
  export HARDHAT_CONFIG_NAME="hardhat.config"
  export USE_REVIVE="true"
  export NETWORK_URL="http://localhost:8545"
  export NODE_PATH=$nodePath
  export ADAPTER_PATH=$adapterPath
  export COMPILER_PATH=$compilerPath
  export USE_FORKING="false"
  export NETWORK_NAME="hardhat"
  export TEST_FILTER=$testFilter
  export VERBOSE_LOGGING=$verboseLogging
  ;;
--westend)
  export HARDHAT_CONFIG_NAME="hardhat.config"
  export USE_REVIVE="true"
  export NETWORK_URL="http://localhost:8545"
  export USE_FORKING="true"
  export NODE_PATH=$nodePath
  export ADAPTER_PATH=$adapterPath
  export COMPILER_PATH=$compilerPath
  export NETWORK_NAME="localhost"
  export TEST_FILTER=$testFilter
  export VERBOSE_LOGGING=$verboseLogging
  ;;
--endpoint | -e)
  if [ "${USER_REVIVE}" = "true" ]; then
    export HARDHAT_CONFIG_NAME="hardhat.config"
  else
    export HARDHAT_CONFIG_NAME="hardhat.evm.config"
  fi
  ;;
*)
  export HARDHAT_CONFIG_NAME="hardhat.evm.config"
  export USE_REVIVE="false"
  export NETWORK_URL="https://ethereum-rpc.publicnode.com"
  export CHAIN_ID=1
  ;;
esac

echo $chain

case "$chain" in
--ethereum)
  echo "Cleaning up"
  rm -rf ./output-logs/geth-output.log
  if [ "${tests}" = "--geth-diff" ]; then
    echo "Starting Geth Ethereum Node"
  else
    echo "Starting Geth Ethereum Node"
    ./networks/ethereum/build/bin/${NETWORK_DIR}/geth --datadir ./networks/ethereum/node1 init ./networks/ethereum/genesis.json &&
      ./networks/ethereum/build/bin/${NETWORK_DIR}/geth --datadir ./networks/ethereum/node1 --syncmode "full" \
        --port 30304 --http --http.addr "localhost" --http.port 8545 --http.corsdomain="*" \
        --networkid 2345 --allow-insecure-unlock --authrpc.port 8553 >./output-logs/geth-output.log 2>&1 &

    echo "Waiting for the Geth to start..."

    while ! grep -q "HTTP server started" ./output-logs/geth-output.log; do
      sleep 1
    done
  fi
  ;;

--acala)
  echo "Cleaning up"
  rm -rf ./output-logs/acala-chopsticks-output.log
  echo "Starting Chopsticks instance"
  npx @acala-network/chopsticks@latest --endpoint=wss://acala-rpc-2.aca-api.network/ws >./output-logs/acala-chopsticks-output.log 2>&1 &
  echo "Waiting for the Chopsticks to start on ws://[::]:8000..."

  while ! grep -q "app: " ./output-logs/acala-chopsticks-output.log; do
    sleep 1
  done

  echo "Chopsticks instance now running on ws://[::]:8000."

  echo "Starting Eth RPC Adapter instance"
  npx @acala-network/eth-rpc-adapter --endpoint ws://localhost:8000 >./output-logs/acala-eth-adapter-output.log 2>&1 &
  echo "Waiting for the eth-rpc-adapter to start on port 8545..."

  while ! grep -q "🚀 SERVER STARTED 🚀" ./output-logs/acala-eth-adapter-output.log; do
    sleep 1
  done

  echo "The eth-rpc-adapter is now running on ws://[::]:8545."
  ;;

--astar)
  echo "Cleaning up"
  rm -rf ./output-logs/astar-chopsticks-output.log
  echo "Starting Chopsticks instance"
  npx @acala-network/chopsticks@latest --endpoint=wss://rpc.astar.network >./output-logs/astar-chopsticks-output.log 2>&1 &
  echo "Waiting for the Chopsticks to start on ws://[::]:8000..."

  while ! grep -q "app: " ./output-logs/astar-chopsticks-output.log; do
    sleep 1
  done

  echo "Chopsticks instance now running on ws://[::]:8000."
  ;;

--kitchensink)
  echo "Running Kitchensink"
  ;;

--westend)
  echo "Forking Asset Hub Westend"
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
  # --open-zeppelin)
  #   run_open_zeppelin_tests
  #   sleep 1
  #   kill -9 $(lsof -t -i:30304)
  #   echo "Geth Ethereum Node Stopped"
  #   ;;
  --geth-diff)
    run_geth_diff_tests
    sleep 1
    ;;
  *)
    run_all_tests
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
  # --open-zeppelin)
  #   run_open_zeppelin_tests
  #   sleep 1
  #   kill -9 $(lsof -t -i:8545)
  #   echo "Eth RPC Adapter Instance Stopped"
  #   kill -9 $(lsof -t -i:8000)
  #   echo "Chopsticks Instance Stopped"
  #   ;;
  *)
    run_all_tests
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
  # --open-zeppelin)
  #   run_open_zeppelin_tests
  #   sleep 1
  #   kill -9 $(lsof -t -i:8000)
  #   echo "Chopsticks Instance Stopped"
  #   ;;
  *)
    run_all_tests
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
    ;;
  # --open-zeppelin)
  #   run_open_zeppelin_tests
  #   ;;
  --geth-diff)
    run_geth_diff_tests
    sleep 1
    ;;
  *)
    run_all_tests
    ;;
  esac
  ;;

--westend)
  case "$tests" in
  --matter-labs)
    run_matter_labs_tests
    ;;
  # --open-zeppelin)
  #   run_open_zeppelin_tests
  #   ;;
  *)
    run_all_tests
    ;;
  esac
  ;;

*)
  case "$tests" in
  --matter-labs)
    run_matter_labs_tests
    ;;
  # --open-zeppelin)
  #   run_open_zeppelin_tests
  #   ;;
  *)
    run_all_tests
    ;;
  esac
  ;;
esac

echo "Final Test Summary:"
echo "Total: $total_tests | Passed: $total_passed | Failed: $total_failed"
