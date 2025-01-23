const { ethers } = require('hardhat');
const { expect } = require('chai');


const { min } = require('../helpers/math');
const time = require('../helpers/time');

const { envSetup } = require('./VestingWallet.behavior');

async function fixture() {
  const amount = ethers.parseEther('100');
  const duration = time.duration.years(4);
  const start = (await time.clock.timestamp()) + time.duration.hours(1);

  const [sender, beneficiary] = await ethers.getSigners();
  const mock = await ethers.deployContract('VestingWallet', [beneficiary, start, duration]);

  const token = await ethers.deployContract('$ERC20', ['Name', 'Symbol']);
  await token.$_mint(mock, amount);
  await sender.sendTransaction({ to: mock, value: amount });

  const env = await envSetup(mock, beneficiary, token);

  const schedule = Array.from({ length: 64 }, (_, i) => (BigInt(i) * duration) / 60n + start);
  const vestingFn = timestamp => min(amount, (amount * (timestamp - start)) / duration);

  return { mock, duration, start, beneficiary, schedule, vestingFn, env };
}

describe('VestingWallet', function () {
  beforeEach(async function () {
    Object.assign(this, await fixture());
  });

  it('rejects zero address for beneficiary', async function () {
    console.log('ZERO ADDRESS: ', ethers.ZeroAddress)
    await expect(ethers.deployContract('VestingWallet', [ethers.ZeroAddress, this.start, this.duration]))
      .revertedWithCustomError(this.mock, 'OwnableInvalidOwner')
      .withArgs(ethers.ZeroAddress);
  });

  it('check vesting contract', async function () {
    expect(await this.mock.owner()).to.equal(this.beneficiary);
    expect(await this.mock.start()).to.equal(this.start);
    expect(await this.mock.duration()).to.equal(this.duration);
    expect(await this.mock.end()).to.equal(this.start + this.duration);
  });

});
