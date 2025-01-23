const { artifacts, ethers } = require('hardhat');
const { generators } = require('./random');

const forceDeployCode = async (name, address = generators.address(), runner = ethers.provider) => {
  const { abi, bytecode } = await artifacts.readArtifact(name);
  
  const factory = new ethers.ContractFactory(abi, bytecode, runner.getSigner());

  const contract = await factory.deploy();
  
  await contract.deployTransaction.wait();

  return contract;
};
