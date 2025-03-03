// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@redstone-finance/evm-connector/contracts/data-services/RapidDemoConsumerBase.sol";

contract ExampleRedstoneShowroom is RapidDemoConsumerBase {
  function getPrices() public view returns(uint256[] memory) {
    bytes32[] memory dataFeedIds = new bytes32[](6);
    dataFeedIds[0] = bytes32("BTC");
    dataFeedIds[1] = bytes32("ETH");
    dataFeedIds[2] = bytes32("BNB");
    dataFeedIds[3] = bytes32("AR");
    dataFeedIds[4] = bytes32("AVAX");
    dataFeedIds[5] = bytes32("CELO");
    return getOracleNumericValuesFromTxMsg(dataFeedIds);
  }
}
