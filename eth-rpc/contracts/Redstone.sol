// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

// TODO restore once https://github.com/paritytech/revive/pull/343 is released
// import '@redstone-finance/evm-connector/contracts/data-services/PrimaryProdDataServiceConsumerBase.sol';
import './node_modules/@redstone-finance/evm-connector/contracts/data-services/PrimaryProdDataServiceConsumerBase.sol';

contract ExampleRedstoneShowroom is  PrimaryProdDataServiceConsumerBase {
    function getPrices() public view returns (uint256[] memory) {
        bytes32[] memory dataFeedIds = new bytes32[](6);
        dataFeedIds[0] = bytes32('BTC');
        dataFeedIds[1] = bytes32('ETH');
        dataFeedIds[2] = bytes32('BNB');
        dataFeedIds[3] = bytes32('AR');
        dataFeedIds[4] = bytes32('AVAX');
        dataFeedIds[5] = bytes32('CELO');
        return getOracleNumericValuesFromTxMsg(dataFeedIds);
    }
}



