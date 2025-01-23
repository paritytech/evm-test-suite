const { ethers } = require('hardhat');
const { expect } = require('chai');
const time = require('../helpers/time');

async function envSetup(mock, beneficiary, token) {
  return {
    eth: {
      checkRelease: async (tx, amount) => {
        await expect(tx).to.changeEtherBalances([mock, beneficiary], [-amount, amount]);
      },
      setupFailure: async () => {
        const beneficiaryMock = await ethers.deployContract('EtherReceiverMock');
        await beneficiaryMock.setAcceptEther(false);
        await mock.connect(beneficiary).transferOwnership(beneficiaryMock);
        return { args: [], error: [mock, 'FailedCall'] };
      },
      releasedEvent: 'EtherReleased',
      args: [],
    },
    token: {
      checkRelease: async (tx, amount) => {
        await expect(tx).to.emit(token, 'Transfer').withArgs(mock, beneficiary, amount);
        await expect(tx).to.changeTokenBalances(token, [mock, beneficiary], [-amount, amount]);
      },
      setupFailure: async () => {
        const pausableToken = await ethers.deployContract('$ERC20Pausable', ['Name', 'Symbol']);
        await pausableToken.$_pause();
        return {
          args: [ethers.Typed.address(pausableToken)],
          error: [pausableToken, 'EnforcedPause'],
        };
      },
      releasedEvent: 'ERC20Released',
    }
  }
}

module.exports = {
  envSetup,
};
