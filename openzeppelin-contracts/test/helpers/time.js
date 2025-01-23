const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { mapValues } = require('./iterate');

const getProvider = async () => {
  const hre = require('hardhat');

  const provider = hre.network.provider;

  return provider;
}

const latest = async () => {
  const provider = await getProvider();

  const latestBlock = (await provider.request({
    method: "eth_getBlockByNumber",
    params: ["latest", false],
  }));

  return parseInt(latestBlock.timestamp, 16);
}

const latestBlock = async () => {
  const provider = await getProvider();

  const height = (await provider.request({
    method: "eth_blockNumber",
    params: [],
  }));

  return parseInt(height, 16);
} 

const clock = {
  blocknumber: () => latestBlock().then(ethers.toBigInt),
  timestamp: () => latest().then(ethers.toBigInt),
};

const clockFromReceipt = {
  blocknumber: receipt => Promise.resolve(ethers.toBigInt(receipt.blockNumber)),
  timestamp: receipt => ethers.provider.getBlock(receipt.blockNumber).then(block => ethers.toBigInt(block.timestamp)),
};

const duration = mapValues(time.duration, fn => n => ethers.toBigInt(fn(ethers.toNumber(n))));

const mine = async (interval = 1) => {
  // Simulate the passage of time (using setTimeout or mocks)
  await new Promise(resolve => setTimeout(resolve, interval * 3000));  // wait for interval in seconds
  
  // Simulate contract state change (e.g., update balances or block-related state)
  // You might need to manually trigger contract calls or set state
}

module.exports = {
  clock,
  clockFromReceipt,
  duration,
  mine
};
