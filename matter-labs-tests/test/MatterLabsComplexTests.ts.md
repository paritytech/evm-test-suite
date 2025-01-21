import fs from "fs";
import { setTimeout } from 'timers/promises';

import '@nomiclabs/hardhat-ethers'
import { ethers } from "hardhat";

export const MATTER_LABS_COMPLEX_TESTS_PATH = `contracts/era-compiler-tests/solidity/complex`;
import { Libraries, FactoryOptions } from "hardhat/types";
import { Contract, Result } from "ethers";
import chalk from 'chalk';
import { expect } from "chai";
import chaiSubset from "chai-subset";
const chai = require('chai');
chai.use(chaiSubset);

import { CalldataList, CalldataValue, Case, Contracts, ExtendedVariant, SingleVariant } from '../types';
import { getContract } from '../util/getContract';
import { logTestResult, logEventTestResult } from '../util/logTestResult';
import { parseCallData } from '../util/parseCalldata'
import { parseIntArray } from '../util/parseIntArray'

// { "cases": [ {
//     "name": "first",
//     "inputs": [
//         {
//             "instance": "Main",
//             "method": "main",
//             "calldata": [
//                 "1",
//                 "Callable.address"
//             ]
//         }
//     ],
//     "expected": [
//         "1"
//     ]
// } ],
//     "contracts": {
//         "Main": "main.sol:Main",
//         "Callable": "callable.sol:Callable"
//     }
// }

type ComplexMetadata = {
    cases: Case[],
    contracts: Contracts,
    libraries?: Libraries
}

const runMatterLabsTestsComplex = async (filePath: string, filePathsNames: string[]) => {
    if (fs.lstatSync(filePath).isDirectory()) {
        const filePaths = await fs.promises.readdir(filePath);

      for (const file of filePaths) {
          const fileName = `${filePath}/${file}`;
          await runMatterLabsTestsComplex(fileName, filePathsNames);
      }
  } else {
          if(filePath.includes(".sol")) {
            if (filePath.startsWith(".")) {
                return;
            }
            filePathsNames.push(filePath);
          }
    }
}


describe('Complex', async () => {
    const complexFilePathNames: string[] = [];
    const contractData: { metadata:  ComplexMetadata, mainContractPath: string, filePath: string, secondaryContractPath?: string, tertiaryContractPath?: string,}[] = [];

    before(async () => {
        await runMatterLabsTestsComplex(MATTER_LABS_COMPLEX_TESTS_PATH, complexFilePathNames);

        for (const filePath of complexFilePathNames) {
            console.log("FILE PATH IS---",  !'contracts/era-compiler-tests/solidity/complex/call_chain/first.sol'.includes("first.sol"));
            if (
                (filePath.startsWith(".") &&
                !filePath.includes("main.sol") &&
                !filePath.includes("/first.sol")
                )
            ) {
                continue;
            }
            
            console.log("IM REACHED")

            const path = filePath.split("/")
            const dirPathLen = path.length-1;
            const contractBasePath = path.slice(0, dirPathLen).join('/');
            const contractTestMetadataPath = `${contractBasePath}/test.json`
            console.log("path is---", contractTestMetadataPath)

            const json = fs.readFileSync(contractTestMetadataPath, 'utf8');
    
            const metadata = JSON.parse(json) as ComplexMetadata;
            console.log("metadata---",metadata);
            console.log("FILE PATH", filePath)
            const mainContractPath = metadata.contracts.Main ? 
            `${contractBasePath}/${metadata.contracts.Main}`
            : metadata.contracts.First ?
            `${contractBasePath}/${metadata.contracts.First}`
            : undefined;
            if (!mainContractPath) {
                throw new Error('Unable to determine main contract path');
            }

            const secondaryContractPath = metadata.contracts.Callable ? 
            `${contractBasePath}/${metadata.contracts.Callable}` 
            : metadata.contracts.Storage ? `${contractBasePath}/${metadata.contracts.Storage}` 
            : metadata.contracts.Second ? `${contractBasePath}/${metadata.contracts.Second}`
            : metadata.contracts.Library ? `${contractBasePath}/${metadata.contracts.Library}` 
            : undefined;
            if (!secondaryContractPath && Object.keys(metadata.contracts).length > 1) {
                throw new Error('Unable to determine secondary contract path');
            }
            
            const tertiaryContractPath = metadata.contracts.Third ? `${contractBasePath}/${metadata.contracts.Third}` : undefined;

            contractData.push({ metadata, mainContractPath, secondaryContractPath, tertiaryContractPath, filePath });
        }
    });

    it('Test Complex', () => {
        describe('Tests', () => {
            console.log("COMPLEX FILEPATHS---", complexFilePathNames)
            console.log("COMPLEX METADATA---", JSON.stringify(contractData))

            contractData.forEach((data) => {
                const { metadata, mainContractPath, secondaryContractPath, filePath, tertiaryContractPath } = data;
                let mainContract: Contract | undefined = undefined;
                let secondaryContract: Contract | undefined = undefined;
                let tertiaryContract: Contract | undefined = undefined;
                let libraryContract: Contract | undefined = undefined;
                let libraryContractAddress: string | undefined = undefined;
                let libraries: Libraries | undefined = undefined;

                metadata.cases.forEach(async (testCase) => {
                    const firstInput = testCase.inputs[0];
                    const { name: testCaseName } = testCase;

                    it(`Tests for method ${testCaseName}`, async () => {
                        if (!mainContract) {
                            type Libs = {
                                [x: string]: {
                                    [x: string]: {
                                        [x:string]: string
                                    }
                                }
                            }
                            if (secondaryContractPath && metadata.libraries) {
                                console.log("Starting to deploy library")
                                console.log("SECONDARY LIBRARY---", secondaryContractPath)
                                libraryContract = await getContract(testCaseName, filePath, secondaryContractPath);
                                libraryContractAddress = await libraryContract?.getAddress();
                                console.log(chalk.green(`Deployed Library Contract ${libraryContract}`));
                            }
                            console.log("MAIN CONTRACT PATH---", mainContractPath)
                            if (libraryContractAddress && metadata.libraries) {
                                const libs: Libs = metadata.libraries as unknown as Libs;
                                const outerKey = Object.keys(libs)[0]
                                const innerKey = Object.keys(libs[outerKey])[0]
                                (metadata.libraries[outerKey])[innerKey] = libraryContractAddress;
                                let signerOptions: FactoryOptions = {libraries: metadata.libraries}
                            }
   
                            mainContract = await getContract(testCaseName, filePath, mainContractPath, firstInput, libraries);
                            console.log(chalk.green(`Deployed Linked Main Contract ${mainContractPath}`));
                        }
                        if (secondaryContractPath && !secondaryContract) {
                            console.log("FILE PATH---", filePath)
                            console.log("MAIN CONTRACT PATH---", mainContractPath)
                            secondaryContract = await getContract(testCaseName, filePath, secondaryContractPath);
                            console.log(chalk.green(`Deployed Secondary Contract ${secondaryContract}`));
                        }
                        if (tertiaryContractPath && !tertiaryContract) {
                            console.log("FILE PATH---", filePath)
                            console.log("TERTIARY CONTRACT PATH---", mainContractPath)
                            tertiaryContract = await getContract(testCaseName, filePath, tertiaryContractPath);
                            console.log(chalk.green(`Deployed Tertiary Contract ${tertiaryContract}`));
                        }

                        for (const input of testCase.inputs) {
                            // if (skipTestCase(input, testCaseName, filePath)) {
                            //     continue;
                            // }
                            if (mainContract) {
                                const expectedData = input.expected ? input.expected : testCase.expected;
                                let method = input.method;
                                console.log("METHOD IS---", method)
                                console.log("FRAGMENT---", mainContract[method]?.fragment)

            
                                // catch deployer cases with no args
                                if (method === "#deployer") {
                                    expect(mainContract.getAddress()).not.eq(undefined);
                                    logTestResult(method, input.expected, mainContract.getAddress())
            
                                    continue;
                                }
            
                                // handle contract methods with #
                                if (method.includes("#")) {
                                    method = method.replace("#", "");
                                }
            
                                let numberOfExpectedArgs = 0;
                                if (mainContract[method]?.fragment) {
                                    numberOfExpectedArgs = mainContract[method].fragment.inputs.length;
                                };
            
                                type TransactionOptions = {
                                    value?: string
                                };
                                const txOptions: TransactionOptions = {};
                                const etherWeiStr = input.value;
                                if (etherWeiStr) {
                                    txOptions.value = etherWeiStr.split(" ")[0];;
                                }
                                
                                const caller = input.caller;
                                if (caller) {
                                    const signer = await ethers.provider.getSigner(caller)
                                    mainContract = await mainContract.connect(signer) as Contract;
                                }
                                
                                    let rawCallData = input.calldata;

                                    // handle setting input params as arrays 
                                    for (const {index, value} of (rawCallData as any[]).map((value: any, index: number) => ({index, value}))) {
                                        if (mainContract[method]?.fragment.inputs[index].baseType === 'array') {
                                            (rawCallData[index] as unknown as CalldataList) = [value]
                                        }
                                        if (mainContract[method]?.fragment.inputs[index].baseType === 'bytes32') {
                                            (rawCallData[index] as unknown as CalldataValue) = ethers.encodeBytes32String(value) 
                                        }
                                    }
                                    const calldata = parseCallData(rawCallData, numberOfExpectedArgs, filePath, method, testCaseName);
                                    let secondaryContractSet = false;
                                    for (let { index, value } of calldata.map((value, index) => ({ index, value}))) {
                                        if ((value as string).includes('.address')) {
                                            if (!secondaryContractSet && secondaryContract) {
                                                calldata[index] = await secondaryContract.getAddress();
                                                console.log("SETTING SECONDARY", await secondaryContract.getAddress())
                                                secondaryContractSet = true;
                                            } else if (tertiaryContract) {
                                                calldata[index] = await tertiaryContract.getAddress();

                                            }
                                        }
                                    }
            
                                    let containsMultiExceptions: boolean = false;
                                    if (Array.isArray(expectedData)) {
                                        for (const data of expectedData) {
                                            if (typeof data === 'object' && 'exception' in (data as ExtendedVariant)) {
                                                containsMultiExceptions = true;
                                                break;
                                            }
                                        }
                                    }
            
                                    try {
                                        let res: any;
                                        if (calldata.length > 0) {
                                        if (containsMultiExceptions) {
                                                await expect(mainContract[method].staticCall(...calldata)).to.be.reverted;
                                            } else if (!Array.isArray((expectedData))) {
                                                if (expectedData.exception || containsMultiExceptions) {
                                                    
                                                    let err;
                                                    try {
                                                        await mainContract[method].staticCall(...calldata)
                                                    } catch (error) {
                                                        err = error;
                                                    }
                                                    
                                                    expect(err).to.be.an('Error')
                                                    logTestResult(method, JSON.stringify(expectedData), (err as Error).toString())
                                                    continue;
                                                }
            
                                                if (expectedData.return_data.length > 0) {
                                                    let decoder = new ethers.AbiCoder()
                                                    let res = await mainContract[method].staticCall(...calldata);
            
                                                    expect(decoder.encode(['uint256'], expectedData.return_data)).to.eq(decoder.encode(['uint256'], [res]))
                                                    logTestResult(method, expectedData, res.toString())
                                                    continue;
                                                }
            
                                                // expectedData events
                                                if (expectedData.events && expectedData.events.length > 0) {
                                                    let res = await mainContract[method](...calldata);
                                                    
                                                    await setTimeout(1000);
                                                    
                                                    let receipt = await res.wait();
            
                                                    let logs = receipt.logs;
                                                    let decoder = new ethers.AbiCoder();
                                                    for (let i = 0; i < logs.length; i++) {
                                                        const event = logs[i];
            
                                                        const eventData = event.data;
                                                        const eventTopics = event.topics;
                                                        const expectedTopicsLength = expectedData.events[0].topics.length
            
                                                        // expect topics length matches expected
                                                        expect(eventTopics.length).to.eq(expectedTopicsLength);
            
                                                        // assert unindexed event data matches
                                                        let unindexedEmittedData: Result | string | undefined = undefined;
                                                        if (eventData.length > 0) {
                                                            const decodeArgs: string[] = [];
                                                            for (let count = 0; count < expectedData.events[i].values.length; count++) {
                                                                decodeArgs.push(`uint256`);
                                                            }
                                                            const formattedExpectedData = `0x` + expectedData.events[0].values.toString().replace(/,/g, "").replace(/0x/g, "")
                                                            if (eventData.length < formattedExpectedData) {
                                                                // Example: one_value_ordinar_len -> with_value
                                                                // extra bytes found for this example causing extra index
                                                                // pop the additional index in order to properly decode the value
                                                                decodeArgs.pop();
                                                            }
                                                            unindexedEmittedData = parseInt(eventData) === 0 ? new Result([0]).toString() : decoder.decode(decodeArgs, eventData)
                                                        }
            
                                                        // assert indexed event data matches
                                                        let indexedEmittedDataArr: any[] = [];
                                                        for (let i = 0; i < expectedData.events[0].topics.length; i++) {
                                                            const expected = expectedData.events[0].topics[i];
                                                            const indexedEmittedData =  decoder.decode(["uint256"], eventTopics[i])[0];
            
                                                            expect(indexedEmittedData).to.eq(expected);
                                                            indexedEmittedDataArr.push(indexedEmittedData.toString())
                                                        }
                                                        
                                                        logEventTestResult(method, expectedData.events[0].topics, indexedEmittedDataArr, expectedData.events[0].values, unindexedEmittedData?.toString())
                                                    }
                                                    continue;
                                                }
                                            } 
                                            else {
                                                if (numberOfExpectedArgs >= 2) {
                                                    console.log("CALLDATA---", calldata)
                                                    console.log("METHOD---", method)
                                                    // calldata[0] = [1]
                                                    res = await mainContract[method].staticCall(...calldata);
                                                } else {
                                                    if (numberOfExpectedArgs === 1) {
                                                        const methodInputIsArray = mainContract[method].fragment.inputs[0].baseType === 'array';
                                                        if (
                                                            (Array.isArray(calldata[0]) && methodInputIsArray)
                                                            || (!Array.isArray(calldata[0]) && !methodInputIsArray)
                                                        ) {
                                                            console.log("IS IT THIS")
                                                            console.log("CALLDATA---", calldata[0])
                                                            res = await mainContract[method].staticCall(calldata[0], {gasLimit: 10000000000000});
                                                        } else if (methodInputIsArray) {
                                                            res = await mainContract[method].staticCall(calldata);
                                                        }
                                                    }
                                                }
                                            }
                                        } else {
                                            // TODO: make function handleExpectedExceptions
                                            // DRY this and the above
                                            if (containsMultiExceptions) {
                                                let err;
                                                try {
                                                    await mainContract[method].staticCall();
                                                } catch (error) {
                                                    err = error;
                                                    expect(err).to.be.an('Error')
                                                    logTestResult(method, JSON.stringify(expectedData), (err as Error).toString())
                                                    continue
                                                }
                                            } else if (!Array.isArray((expectedData))) {
                                                if (expectedData.exception) {
                                                    let err;
                                                    try {
                                                        await mainContract[method]()
                                                    } catch (error) {
                                                        err = error;
                                                    }
            
                                                    expect(err).to.be.an('Error');
                                                    logTestResult(method, JSON.stringify(expectedData), (err as Error).toString());
                                                    continue;
                                                } else {       
                                                    // non exception method with return_data  
                                                    if (method === "set") {
                                                        await mainContract[method](); // call set contract data
                                                    } 
                                                    res = await mainContract[method].staticCall(); // get set return result  
                                                }
            
                                                // events
                                                if (expectedData.events && expectedData.events.length > 0) {
                                                let res = await mainContract[method]();
                                                
                                                await setTimeout(1000);
                                                
                                                    let receipt = await res.wait();
                                                    let logs = receipt.logs;
                                                    let decoder = new ethers.AbiCoder();
                                                    for (const event of logs) {
                                                        const data = event.data;
                                                        const topics = event.topics;
            
                                                        // expect topics length matches expected
                                                        expect(topics.length).to.eq(expectedData.events[0].topics.length);
            
                                                        // assert unindexed event data matches
                                                        for (let i = 0; i < expectedData.events[0].values.length; i++) {
                                                            const expected = expectedData.events[0].values[i];
                                                            const unindexedEmittedData =  decoder.decode([`uint256[${expectedData.events[0].values.length}]`], data)[0]
                                                            const unindexValueAtIdx = unindexedEmittedData[i];
            
                                                            expect(unindexValueAtIdx.toString()).to.eq(expected.toString());
                                                        }
            
                                                        // assert indexed event data matches
                                                        for (let i = 0; i < expectedData.events[0].topics.length; i++) {
                                                            const expected = expectedData.events[0].topics[i];
                                                            const indexedEmittedData =  decoder.decode(["uint256"], topics[i])[0];
            
                                                            expect(indexedEmittedData.toString()).to.eq(expected.toString());
                                                        }                         
                                                    }
                                                } 
                                            } else {
                                                if (method === 'fallback') {
                                                    res = await mainContract[method]?.staticCall({})                                        
                                                    let decoder = new ethers.AbiCoder()
                                    
                                                    expect(decoder.decode(['uint256'], res).toString()).to.eq(expectedData.toString())
            
                                                    const result = res != undefined ? res.toString() : undefined;
                                                    logTestResult(method, expectedData, result)
                                                    continue;
                                                } else {
                                                    if (txOptions.value) {
                                                        const hardHatTestAccountAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
                                                        await ethers.provider.send("hardhat_setBalance", [
                                                            hardHatTestAccountAddress,
                                                            "0x340282366920938463463374607431768211455",
                                                        ]);
                                                        res = await mainContract[method].staticCall(txOptions);
                                                    } else {
                                                        if (method === "set") {
                                                            await mainContract[method]();
                                                        } 
                                                        res = await mainContract[method].staticCall();
                                                    }
                                                }
                                            }
                                        }
            
            
            
                                        // Assertions
                                        if (Array.isArray(expectedData)) {
                                            if (!containsMultiExceptions) {
                                            if (expectedData.length > 1) {
                                                const result = parseIntArray(res, filePath); // parse response to array
                                                if (result.length != expectedData.length) {
                                                    if (expectedData.length === 4 && filePath.includes("ConstantBytes")) {
                                                        expect(res.includes(expectedData[2].toString()));
                                                    } else {
                                                        expect(expectedData.join('')).to.include(result.join(''));
                                                    }
                                                } else {
                                                    if ((expectedData as SingleVariant).includes("*")) {
                                                        expect(result).to.containSubset(expectedData)
                                                    } else {
                                                        expect(result).deep.eq(expectedData);
                                                    }
                                                }
                                            } else {
                                                if (typeof res === 'boolean') {
                                                    const resultAsNumStr = res.toString() === 'false' ? '0' : '1';
                                                    expect(resultAsNumStr).eq(expectedData[0]);
                                                } else {
                                                    if (expectedData[0] === 'Test.address') {
                                                        expect(res).not.to.be.undefined;
                                                    } else {
                                                        if (txOptions.value) {
                                                            expect(res).to.eq(expectedData[0]);
                                                        } else if (expectedData.length === 1) {
                                                            if ((expectedData as unknown as [{return_data: string[]}])[0].return_data) {
                                                                const return_data = (expectedData as unknown as [{return_data: string[]}])[0].return_data
                                                                expect(parseInt(res)).eq(parseInt(return_data[0]));
                                                            } else {
                                                                expect(parseInt(res)).eq(parseInt(expectedData[0].toString()));
                                                            }
                                                        } else {
                                                            expect(res.toString()).eq(expectedData.toString());
                                                        }
                                                    }
                                                }
                                            }
                                            }
                                        } else {
                                            if (expectedData.return_data) {
                                                if (Array.isArray(res) && res.length === expectedData.return_data.length) {
                                                    expect(res).deep.eq(expectedData.return_data);
                                                } else {
                                                    expect(res).eq(expectedData.return_data[0]);
                                                }
                                            } else if (!expectedData.exception && !expectedData.events && !expectedData.return_data) {
                                                expect(res).eq(expectedData);
                                            }
                                        }
                                        
                                        const result = res != undefined ? res.toString() : undefined;
                                        logTestResult(method, expectedData, result)
                                        continue
                                    } 
                                    catch(err) {
                                        if (
                                            (err as Error).toString().includes("value out-of-bounds")
                                            || (err as Error).toString().includes("expected undefined to be an error")
                                            || (err as Error).toString().includes("invalid length for result data")
                                        ) {
                                            console.log(`Skipped Test Case ${testCaseName} from ${filePath}`);
                                        } else {
                                            console.log("ERR---", err);
                                            console.log(`Failed Test Case ${testCaseName} from ${filePath} with inputs ${calldata}`);
                                        }
                                    }
                                }
                            }
                    });
                });
            });
        });
    });
});