const { ethers } = require('hardhat');
const { expect } = require('chai');

const mine = async (interval = 1) => {
  await new Promise(resolve => setTimeout(resolve, interval * 3000));
}

describe('Environment sanity', function () {
  beforeEach(async function () {
    Object.assign(this, {});
  });

  describe('snapshot', function () {
    let blockNumberBefore;

    it('cache and mine', async function () {
      blockNumberBefore = await ethers.provider.getBlockNumber();
      await mine();
      expect(await ethers.provider.getBlockNumber()).to.equal(blockNumberBefore + 1);
    });

    it('check snapshot', async function () {
      expect(await ethers.provider.getBlockNumber()).to.equal(blockNumberBefore);
    });
  });
});
