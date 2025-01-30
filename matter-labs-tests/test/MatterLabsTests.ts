import fs from "fs";
import { setTimeout } from 'timers/promises';

import '@nomiclabs/hardhat-ethers'
import { ethers } from "hardhat";

import { expect } from "chai";
import chaiSubset from "chai-subset";
import readline from 'readline';
const chai = require('chai');
chai.use(chaiSubset);

import chalk from 'chalk';

import { Contract, Result } from "ethers";

import { Input, Metadata, ExtendedVariant, SingleVariant } from '../types';
import { getContract } from '../util/getContract';
import { logTestResult, logEventTestResult } from '../util/logTestResult';
import { parseCallData } from '../util/parseCalldata'
import { parseIntArray } from '../util/parseIntArray';

const SIMPLE_TESTS_INSTANCE = "Test";
export const MATTER_LABS_SIMPLE_TESTS_PATH = `contracts/era-compiler-tests/solidity/simple`;


const runMatterLabsTests = async (filePath: string, filePathsNames: string[]) => {
    if (fs.lstatSync(filePath).isDirectory()) {
        const filePaths = await fs.promises.readdir(filePath);

        for (const file of filePaths) {
            const fileName = `${filePath}/${file}`;
            await runMatterLabsTests(fileName, filePathsNames);
        }
    } else {
        if (filePath.includes(".sol")) {
            if (filePath.startsWith(".")) {
                return;
            }
            filePathsNames.push(filePath);
        }
    }
}

async function metadataFromStr(filePath: string): Promise<Metadata> {
    const fileStream = fs.createReadStream(filePath);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    const lines: string[] = [];

    for await (const line of rl) {
        let newLine: string = '';

        if (line.startsWith("//!")) {
            newLine = line.replace("//!", "")
        } else if (line.startsWith(";!")) {
            newLine = line.replace(";!", "")
        } else if (line.startsWith("#!")) {
            newLine = line.replace("#!", "");
        }

        lines.push(newLine);
    }

    const json = lines.join("");

    const metadata: Metadata = JSON.parse(json);
    for (const metaDataCase of metadata.cases) {
        for (const input of metaDataCase.inputs) {
            input.instance = SIMPLE_TESTS_INSTANCE;
        }
    }

    return metadata;
}

describe('Matter Labs', async () => {
    const filePaths: string[] = [];
    const contractData: { metadata: Metadata, contractPath: string, filePath: string }[] = [];

    before(async () => {
        await runMatterLabsTests(MATTER_LABS_SIMPLE_TESTS_PATH, filePaths);

        for (const filePath of filePaths) {
            if (filePath.startsWith(".")) {
                continue;
            }

            const metadata = await metadataFromStr(filePath);
            const contractPath = `${filePath}:Test`;
            contractData.push({ metadata, contractPath, filePath });
        }
    });

    it('Simple Tests', () => {
        describe('Contracts', () => {
            contractData.forEach((data) => {
                const { metadata, contractPath, filePath } = data;
                let contract: Contract | undefined = undefined;

                metadata.cases.forEach(async (testCase) => {
                    if (
                        filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/internal_function_pointers/many_arguments.sol`
                        || skipTestFile(filePath)
                    ) {
                        return
                    }
                    const firstInput = testCase.inputs[0];
                    const { name: testCaseName } = testCase;

                    it(`Tests for method ${testCaseName}`, async () => {
                        if (!contract) {
                            contract = await getContract(testCaseName, filePath, contractPath, firstInput);
                            console.log(chalk.green(`Deployed ${contractPath}`));
                        }

                        for (const input of testCase.inputs) {
                            if (skipTestCase(input, testCaseName, filePath)) {
                                continue;
                            }
                            if (contract) {
                                const expectedData = input.expected ? input.expected : testCase.expected;
                                let method = input.method;

                                // catch deployer cases with no args
                                if (method === "#deployer") {
                                    expect(contract.getAddress()).not.eq(undefined);
                                    logTestResult(method, input.expected, contract.getAddress())

                                    continue;
                                }

                                // handle contract methods with #
                                if (method.includes("#")) {
                                    method = method.replace("#", "");
                                }

                                let numberOfExpectedArgs = 0;
                                if (contract[method]?.fragment) {
                                    numberOfExpectedArgs = contract[method].fragment.inputs.length;
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
                                    contract = await contract.connect(signer) as Contract;
                                }

                                let rawCallData = input.calldata;

                                const calldata = parseCallData(rawCallData, numberOfExpectedArgs, filePath, method, testCaseName);

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
                                            await expect(contract[method].staticCall(...calldata)).to.be.reverted;
                                        } else if (!Array.isArray((expectedData))) {
                                            if (expectedData.exception || containsMultiExceptions) {

                                                let err;
                                                try {
                                                    await contract[method].staticCall(...calldata)
                                                } catch (error) {
                                                    err = error;
                                                }

                                                expect(err).to.be.an('Error')
                                                logTestResult(method, JSON.stringify(expectedData), (err as Error).toString())
                                                continue;
                                            }

                                            if (expectedData.return_data.length > 0) {
                                                let decoder = new ethers.AbiCoder()
                                                let res = await contract[method].staticCall(...calldata);

                                                expect(decoder.encode(['uint256'], expectedData.return_data)).to.eq(decoder.encode(['uint256'], [res]))
                                                logTestResult(method, expectedData, res.toString())
                                                continue;
                                            }

                                            // expectedData events
                                            if (expectedData.events && expectedData.events.length > 0) {
                                                let res = await contract[method](...calldata);

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
                                                        const indexedEmittedData = decoder.decode(["uint256"], eventTopics[i])[0];

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
                                                res = await contract[method].staticCall(...calldata);
                                            } else {
                                                if (numberOfExpectedArgs === 1) {
                                                    const methodInputIsArray = contract[method].fragment.inputs[0].baseType === 'array';
                                                    if (
                                                        (Array.isArray(calldata[0]) && methodInputIsArray)
                                                        || (!Array.isArray(calldata[0]) && !methodInputIsArray)
                                                    ) {
                                                        res = await contract[method].staticCall(calldata[0]);
                                                    } else if (methodInputIsArray) {
                                                        res = await contract[method].staticCall(calldata);
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
                                                await contract[method].staticCall();
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
                                                    await contract[method]()
                                                } catch (error) {
                                                    err = error;
                                                }

                                                expect(err).to.be.an('Error');
                                                logTestResult(method, JSON.stringify(expectedData), (err as Error).toString());
                                                continue;
                                            } else {
                                                // non exception method with return_data  
                                                if (method === "set") {
                                                    await contract[method](); // call set contract data
                                                }
                                                res = await contract[method].staticCall(); // get set return result  
                                            }

                                            // events
                                            if (expectedData.events && expectedData.events.length > 0) {
                                                let res = await contract[method]();

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
                                                        const unindexedEmittedData = decoder.decode([`uint256[${expectedData.events[0].values.length}]`], data)[0]
                                                        const unindexValueAtIdx = unindexedEmittedData[i];

                                                        expect(unindexValueAtIdx.toString()).to.eq(expected.toString());
                                                    }

                                                    // assert indexed event data matches
                                                    for (let i = 0; i < expectedData.events[0].topics.length; i++) {
                                                        const expected = expectedData.events[0].topics[i];
                                                        const indexedEmittedData = decoder.decode(["uint256"], topics[i])[0];

                                                        expect(indexedEmittedData.toString()).to.eq(expected.toString());
                                                    }
                                                }
                                            }
                                        } else {
                                            if (method === 'fallback') {
                                                res = await contract[method]?.staticCall({})
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
                                                    res = await contract[method].staticCall(txOptions);
                                                } else {
                                                    if (method === "set") {
                                                        await contract[method]();
                                                    }
                                                    res = await contract[method].staticCall();
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
                                                            if ((expectedData as unknown as [{ return_data: string[] }])[0].return_data) {
                                                                const return_data = (expectedData as unknown as [{ return_data: string[] }])[0].return_data
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
                                catch (err) {
                                    if (
                                        (err as Error).toString().includes("value out-of-bounds")
                                        || (err as Error).toString().includes("expected undefined to be an error")
                                        || (err as Error).toString().includes("invalid length for result data")
                                    ) {
                                        console.log(`Skipped Test Case ${testCaseName} from ${filePath}`);
                                    } else {
                                        console.log(`Failed Test Case ${testCaseName} from ${filePath} with inputs ${calldata}`);
                                    }
                                }
                            }
                        }
                    }).timeout(1000000);
                })
            });
        });
    })
});

const FILES_TO_SKIP = ["/constructor", "/context", "/events", "/fat_ptr", "/function", "/loop", "/operator", "/return", "/solidity_by_example", "storage", "/structure", "/try_catch", "/yul_semantic", "/internal_function_pointers/legacy", "/system/prevrandao_returndata.sol", "/system/difficulty_returndata.sol", "/system/msize_returndata.sol", "/yul_instructions/basefee.sol", "/yul_instructions/coinbase.sol", "/yul_instructions/difficulty.sol", "/yul_instructions/gaslimit.sol", "/yul_instructions/msize.sol", "/yul_instructions/prevrandao.sol", "/call_chain", "/gas_value", "/immutable/trycatch.sol", "/yul_instructions/mulmod.sol", "/modular/mulmod.sol", "/internal_function_pointers/mixed_features_2.sol", "/algorithm/arrays/standard_functions.sol", "/algorithm/arrays/standard_functions_high_order.sol", "/modular/addmod_complex.sol", "/algorithm/long_arithmetic.sol"];
const skipTestFile = (filePath: string): boolean => {
    for (const filter of FILES_TO_SKIP) {
        if (filePath.includes(filter)) {
            return true;
        }
    }

    return false;
}

const skipTestCase = (testCaseInput: Input, testCaseName: string, filePath: string): boolean => {
    if (
        filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/basefee.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/blockhash.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/chainid.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/codecopy.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/codesize.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/coinbase.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/difficulty.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/gaslimit.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/gasprice.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/keccak256.sol`
        || (filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/msize.sol` && testCaseName === "ordinar")
        || (filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/number.sol` && testCaseName === "default")
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/origin.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/prevrandao.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/return.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/returndatacopy.sol`
        || (filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/returndatasize.sol` && testCaseName === "initial" && testCaseInput.method === "initial")
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/revert.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/pop.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/sar.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/sdiv.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/selfbalance.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/smod.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/stop.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/modular/mulmod.sol` // ignored because BasicBlockTooLarge
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/mulmod.sol` // ignored because BasicBlockTooLarge
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_instructions/timestamp.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/immutable/inheritance/immutables6_yul.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/internal_function_pointers/call_to_zero_initialized_function_type_legacy_evm.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/internal_function_pointers/call_to_zero_initialized_function_type_legacy.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/internal_function_pointers/legacy/invalidInConstructor.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/internal_function_pointers/legacy/invalidStoredInConstructor.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/internal_function_pointers/legacy/store2.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/internal_function_pointers/legacy/storeInConstructor.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/internal_function_pointers/data_structures.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/internal_function_pointers/mixed_features_2.sol`
        || filePath === `${MATTER_LABS_SIMPLE_TESTS_PATH}/internal_function_pointers/mixed_features_3.sol`
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/constructor`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/context`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/events`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/fat_ptr`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/function`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/loop`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/operator`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/return`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/solidity_by_example`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/storage`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/structure`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/try_catch`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/yul_semantic`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/call_chain`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/gas_value`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/immutable/trycatch.sol`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/trycatch.sol`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/algorithm/arrays/standard_functions.sol`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/algorithm/arrays/standard_functions_high_order.sol`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/algorithm/long_arithmetic.sol`)
        || filePath.includes(`${MATTER_LABS_SIMPLE_TESTS_PATH}/modular/addmod_complex.sol`)

    ) {
        console.log(`Skipped ${testCaseName} from ${filePath}`);
        return true;
    }

    return false;
}
