import '@nomiclabs/hardhat-ethers'
import { ethers } from "hardhat";
import { Libraries } from 'hardhat/types';
import { BaseContract, Contract, ContractFactory } from "ethers";
import { expect } from "chai";

import { Input } from '../types';

export const getContract = async (testCaseName: string, filePath: string, contractPath: string, input?: Input, libraries?: Libraries): Promise<Contract | undefined> => {
    let contract: Contract | undefined = undefined;
    let contractFactory: ContractFactory<any[], BaseContract> | undefined = undefined;

    // default #deployer cases
    if ((input && input.calldata.length > 0 && input.method === "#deployer")) {
        try {
            if (libraries != undefined) {
                contractFactory = await ethers.getContractFactory(contractPath, {
                    libraries,
                });
            } else {
                contractFactory = await ethers.getContractFactory(contractPath);
            }
        }catch(e) {
            console.log(`Failed to get contract factory: ${e}`);
        }

        // get correct inputs
        let inputs: any[] = [];

        if (filePath.includes("zero_value")) {
            inputs =  [input.calldata[0]];
        } else {
            inputs = [...input.calldata];
        }

        if (testCaseName != "failure") {
            let deployedContract: BaseContract | undefined = undefined;

            if (input.caller) {
                await ethers.provider.send("hardhat_impersonateAccount", [input.caller]);
                await ethers.provider.send("hardhat_setBalance", [
                    input.caller,
                    "0x340282366920938463463374607431768211455",
                ]);
                const signer = await ethers.provider.getSigner(input.caller);
                deployedContract = await contractFactory?.connect(signer).deploy(...inputs);
            } else {
                try {
                    deployedContract = await contractFactory?.deploy({overrides: inputs});
                } catch(err) {
                    deployedContract = await contractFactory?.deploy(...inputs);
                }
            }

            const contractAddress = await deployedContract?.getAddress();
            if (input.expected?.toString().includes("Test.address")) {
                expect(contractAddress).not.to.eq(undefined);
            }

            if (contractAddress) {
                contract = await ethers.getContractAt(contractPath, contractAddress);
            }
        } else {
            await expect(contractFactory?.deploy(...inputs)).to.be.reverted;

            return undefined;
        }
    } else {
        let deployedContract: BaseContract | undefined = undefined;

        try {
            if (libraries) {
                deployedContract = await ethers.deployContract(contractPath, {
                    libraries,
                });
            } else {
                deployedContract = await ethers.deployContract(contractPath);
            }
        } catch(e) {
            throw new Error(`Failed to Deploy Contract ${contractPath}: \n${e}`);
        }
        const contractAddress = await deployedContract.getAddress();
        contract = await ethers.getContractAt(contractPath, contractAddress);
    }

    return contract;
}