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

import { BaseContract, Contract, Result } from "ethers";
const SIMPLE_TESTS_INSTANCE = "Test";


type CalldataValue = string;
type CalldataList = string[];
type Calldata = CalldataList | CalldataValue;

type StorageList = {
    kind: 'StorageList';
    data: string[];
}
type StorageMap = {
    kind: 'StorageMap';
    data: Map<string, string>;
}

type StorageItem = StorageList | StorageMap;

type EventItem = {
    /// The emitter contract address.
   address: string | undefined;
    /// The indexed topics.
   topics: string[];
    /// The ordinary values.
   values: string[];
}

enum Op {
    Exact,
    Greater,
    GreaterEq,
    Less,
    LessEq,
    Tilde,
    Caret,
    Wildcard,
    __NonExhaustive,
}

type Identifier = {
    head: string;
    tail: string[];
}

type Prerelease = {
    identifier: Identifier;
}

/// A pair of comparison operator and partial version, such as `>=1.2`. Forms
/// one piece of a VersionReq.
type Comparator = {
    op: Op;
    major: number;
    minor: number | undefined;
    /// Patch is only allowed if minor is Some.
    patch: number | undefined;
    /// Non-empty pre-release is only allowed if patch is Some.
    pre: Prerelease;
}

type VersionReq = {
    comparators: Comparator[];
}

type Extended = {
    /// The return data values.
   return_data: string[];
    /// The emitted events.
   events?: EventItem[];
    /// Whether an exception is expected,
   exception: boolean;
    /// The compiler version filter.
   compilerVersion: VersionReq | undefined;
}

type SingleVariant =  string[];
type ExtendedVariant = Extended;
type Variant  = SingleVariant | ExtendedVariant;

type SingleExpected = Variant;
type MultipleExpected = Variant[];
type Expected = SingleExpected | MultipleExpected;

type Input = {
    /// The comment to an entry.
    comment: string | undefined;
    /// The contract instance.
    instance: string;
    /// The caller address.
    caller: string;
    /// The contract method name.
    /// `#deployer` for the deployer call
    /// `#fallback` for the fallback
    method: string;
    /// The passed calldata.
    calldata: Calldata;
    /// The passed value.
    value: string | undefined;
    /// The initial contracts storage.
    storage: Map<string, StorageItem>;
    /// The expected return data.
    expected: Expected | undefined;
}

type Case = {
    /// The comment to a case.
    comment: string | undefined;
    /// The case name.
    name: string;
    /// The mode filter.
    modes: string[] | undefined;
    /// The case inputs.
    inputs: Input[];
    /// The expected return data.
    expected: Expected;
    /// If the test case must be ignored.
    ignore: boolean;
    /// Overrides the default number of cycles.
    cycles: number | undefined;
}

type EVMContract = {
    /// The runtime code.
    runtimeCode: string;
}

enum Target {
    /// The EraVM target.
    EraVM,
    /// The native EVM target.
    EVM,
    /// The EVM interpreter running on top of EraVM.
    EVMInterpreter,
}

type Metadata = {
    /// The test cases.
    cases: Case[];
    /// The mode filter.
    modes: string[] | undefined;
    /// The test contracts.
    /// The format is `instance -> path`.
    contracts: Map<string, string>;
    /// The EVM auxiliary contracts.
    /// The format is `instance -> init code`.
    evmContracts: Map<string, EVMContract>;
    /// The test libraries for linking.
    libraries: Map<string, Map<string, string>>;
    /// Enable the EraVM extensions.
    enableEravmExtensions: boolean;
    /// The target to run the test on.
    target: Target | undefined;
    /// If the entire test file must be ignored.
    ignore: boolean;
    /// The test group.
    group: string | undefined;
}

const runMatterLabsTests = async (filePath: string, failedTests: any[], passedTests: any[], skippedTests: any[]) => {
    if (fs.lstatSync(filePath).isDirectory()) {
        const filePaths = await fs.promises.readdir(filePath);

      for (const file of filePaths) {
          const fileName = `${filePath}/${file}`;
          await runMatterLabsTests(fileName, failedTests, passedTests, skippedTests);
      }
  } else {
          if(filePath.includes(".sol")) {
            if (filePath.startsWith(".")) {
                return;
            }
            const metadata = await metadataFromStr(filePath);

            const contractPath = `${filePath}:Test`;
            await runContractTests(metadata, filePath, failedTests, passedTests, skippedTests, contractPath);
          }
    }
}

const getContract = async (passedTests: any[], testCaseName: string, filePath: string, contractPath: string, input: Input): Promise<Contract | undefined> => {
    let contract: Contract | undefined = undefined;
    
    // default #deployer cases
    if (input.calldata.length > 0 && input.method === "#deployer") {
        const contractFactory = await ethers.getContractFactory(contractPath);

        // get correct inputs
        let inputs: any[] = [];

        if (filePath.includes("zero_value")) {
            inputs =  [input.calldata[0]];
        } else {
            inputs = [...input.calldata]
        }

        if (testCaseName != "failure") {
            let deployedContract: BaseContract | undefined = undefined;

            if (input.caller) {
                await ethers.provider.send("hardhat_impersonateAccount", [input.caller]);
                await ethers.provider.send("hardhat_setBalance", [
                    input.caller,
                    "0x340282366920938463463374607431768211455",
                ]);
                const signer = await ethers.provider.getSigner(input.caller)
                deployedContract = await contractFactory.connect(signer).deploy(...inputs)
            } else {
                try {
                    deployedContract = await contractFactory.deploy({overrides: inputs});
                } catch(err) {
                    deployedContract = await contractFactory.deploy(...inputs);
                }
            }

            const contractAddress = await deployedContract.getAddress();
            if (input.expected?.toString().includes("Test.address")) {
                expect(contractAddress).not.to.eq(undefined);
                passedTests.push({filePath, testCaseName, method: input.method, inputs});
            }

            contract = await ethers.getContractAt(contractPath, contractAddress);
        } else {
            await expect(contractFactory.deploy(...inputs)).to.be.reverted;

            return undefined;
        }
    } else {
        const deployedContract = await ethers.deployContract(contractPath);
        await deployedContract.waitForDeployment();
        const contractAddress = await deployedContract.getAddress();
        contract = await ethers.getContractAt(contractPath, contractAddress);
    }

    return contract;
}


const runContractTests = async (metadata: Metadata, filePath: string, failedTests: any[], passedTests: any[], skippedTests: any[], contractPath: string) => {
        let contract: Contract | undefined = undefined;

        for (let i = 0; i < metadata.cases.length; i++) {
            const testCase = metadata.cases[i];
            const firstInput = testCase.inputs[0];
            const { name: testCaseName } = testCase;

            if (!contract) {
                contract = await getContract(passedTests, testCaseName, filePath, contractPath, firstInput);
                console.log(chalk.green(`Deployed ${contractPath}`));
            }

            for (const input of testCase.inputs) {
                if (skipTestCase(input, testCaseName, filePath, skippedTests)) {
                    continue;
                }
                if (contract) {
                    const expectedData = input.expected ? input.expected : testCase.expected;
                    let method = input.method;

                    // catch deployer cases with no args
                    if (method === "#deployer") {
                        expect(contract.getAddress()).not.eq(undefined);
                        processPassedTest(filePath, passedTests, testCaseName, method, input.calldata)

                        continue;
                    }

                    // handle contract methods with #
                    if (method.includes("#")) {
                        method = method.replace("#", "");
                    }

                    let numberOfExpectedArgs = 0;
                    if (contract[method].fragment) {
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
                        const inputs = calldata;

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
                                    if (expectedData.exception) {
                                        
                                        let err;
                                        try {
                                          await contract[method].staticCall(...calldata)
                                        } catch (error) {
                                            err = error;
                                        }
                                        
                                        expect(err).to.be.an('Error')
                                        processPassedTest(filePath, passedTests, testCaseName, method, inputs, expectedData, err)
                                        // passedTests.push({filePath, testCaseName, method, inputs, expected: expectedData, result: err})
                                        continue;
                                    }

                                    if (expectedData.return_data.length > 0) {
                                        let decoder = new ethers.AbiCoder()
                                        let res = await contract[method].staticCall(...calldata);

                                        expect(decoder.encode(['uint256'], expectedData.return_data), decoder.encode(['uint256'], [res]))
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
                                            let decodedExpectedData: Result | string | undefined = undefined;
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
                                                decodedExpectedData = parseInt(eventData) === 0 ? new Result([0]).toString() : decoder.decode(decodeArgs, formattedExpectedData)
                                            }

                                            // assert indexed event data matches
                                            let indexedEmittedDataArr: any[] = [];
                                            for (let i = 0; i < expectedData.events[0].topics.length; i++) {
                                                const expected = expectedData.events[0].topics[i];
                                                const indexedEmittedData =  decoder.decode(["uint256"], eventTopics[i])[0];

                                                expect(indexedEmittedData).to.eq(expected);
                                                indexedEmittedDataArr.push(indexedEmittedData.toString())
                                            }

                                            console.log(`Passed test: ${testCaseName} from ${filePath}`);
                                            passedTests.push({filePath, testCaseName, method, inputs, expectedIndexedData: expectedData.events[0].topics, decodedIndexedEventDataResult: indexedEmittedDataArr, expectedUnindexedData: expectedData.events[0].values, decodedUnindexedEventDataResult: unindexedEmittedData?.toString()})
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
                                    await expect(contract[method].staticCall()).to.be.reverted;
                                } else if (!Array.isArray((expectedData))) {
                                    if (expectedData.exception) {
                                        let err;
                                        try {
                                            await contract[method].staticCall(...calldata);
                                        } catch (error) {
                                            err = error;
                                        }

                                        expect(err).to.be.an('Error');
                                        processPassedTest(filePath, passedTests, testCaseName, method, inputs, expectedData, err);
                                        // passedTests.push({filePath, testCaseName, method, inputs, expected: expectedData, result: err});
                                        continue;
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
                                        res = await contract[method]?.staticCall({})                                        
                                        let decoder = new ethers.AbiCoder()
                        
                                        expect(decoder.decode(['uint256'], res).toString()).to.eq(expectedData.toString())

                                        const result = res != undefined ? res.toString() : undefined;
                                        processPassedTest(filePath, passedTests, testCaseName, method, inputs, expectedData, result)
                                        // passedTests.push({filePath, testCaseName, method, inputs, expected: expectedData, result})
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
                                                expect(parseInt(res)).eq(parseInt(expectedData[0].toString()));
                                            } else {
                                                expect(res.toString()).eq(expectedData.toString());
                                            }
                                        }
                                    }
                                }
                                }
                            } else {
                                if (!expectedData.exception && !expectedData.events && !expectedData.return_data) {
                                    expect(res).eq(expectedData);
                                }
                            }
                            
                            const result = res != undefined ? res.toString() : undefined;
                            processPassedTest(filePath, passedTests, testCaseName, method, inputs, expectedData, result)
                            // passedTests.push({filePath, method, inputs, expected: expectedData, result});
                        } catch(err) {
                            if (
                                JSON.stringify(err).includes("value out-of-bounds")
                                || JSON.stringify(err).includes("expected undefined to be an error")
                                || JSON.stringify(err).includes("invalid length for result data")
                            ) {
                                console.log(`Skipped ${testCaseName} from ${filePath}`);
                                skippedTests.push({filePath, testCaseName, method, inputs, err});
                            } else {
                                console.log(`Failed ${testCaseName} from ${filePath}`);
                                failedTests.push({filePath, testCaseName, method, inputs, err});
                            }
                        }
                }
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

        if(line.startsWith("//!")) {
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
  
describe('Matter Labs EVM Tests', () => {
    it('Run Test Suite', async () => {
        const matterLabsTestPath = 'contracts';

        const passedTests: any[] = [];
        const failedTests: any[] = [];
        const skippedTests: any[] = [];

        await runMatterLabsTests(matterLabsTestPath, failedTests, passedTests, skippedTests);

        console.log(chalk.green(`\nPassed: ${passedTests.length}`));
        console.log(chalk.red(`Failed: ${failedTests.length}`));
        console.log(chalk.yellow(`Skipped: ${skippedTests.length}`));

        fs.writeFileSync("testResults/failedTests.json", JSON.stringify({NumFailed: failedTests.length, failedTests}), {encoding:'utf8', flag:'w'});
        fs.writeFileSync("testResults/passedTests.json", JSON.stringify({NumPassed: passedTests.length, passedTests}), {encoding:'utf8', flag:'w'});
        fs.writeFileSync("testResults/skippedTests.json", JSON.stringify({NumSkipped: skippedTests.length, skippedTests}), {encoding:'utf8', flag:'w'});
    }).timeout(1500000)
})

const parseIntArray = (array: any[], filePath: string): string[] => {
    const arr: string[] = [];

   for (let data of array) {
        if (Array.isArray(data)) {
            for (let val of data) {
                if (Array.isArray(val)) {
                    for (let v of val) {
                        if (filePath.includes("address_size")) {
                            if (Number.isInteger(parseInt(v)) && v.toString().length >= 4) {
                                v = "*";
                            } else {
                                v = v.toString() === 'false' ? 1 : v.toString() === 'true' ? 0 : v;
                            }
                        } else {
                            v = v.toString() === 'false' ? 0 : v.toString() === 'true' ? 1 : v;
                        }
                        arr.push(v.toString());
                    }
                } else {
                    if (filePath.includes("address_size")) {
                        if (Number.isInteger(parseInt(val)) && val.toString().length >= 4) {
                            val = "*";
                        } else {
                            val = val.toString() === 'false' ? 1 : val.toString() === 'true' ? 0 : val;
                        }
                    }else {
                        val = val.toString() === 'false' ? 0 : val.toString() === 'true' ? 1 : val;
                    }
                    arr.push(val.toString());
                }
            }
        } else {
            if (filePath.includes("address_size")) {
                if (Number.isInteger(parseInt(data)) && data.toString().length >= 4) {
                    data = "*";
                } else {
                    data = data.toString() === 'false' ? 1 : data.toString() === 'true' ? 0 : data;
                }
            }else {
                data = data.toString() === 'false' ? 0 : data.toString() === 'true' ? 1 : data;
            }
            arr.push(data.toString());
        }
    }

    return arr;
}

const parseCallData = (rawCallData: Calldata, numberOfExpectedArgs: number, filePath: string, method: string, testCaseName: string): any[] => {
    const callDataLength = rawCallData.length;
    const calldata: any[] = [];

    if (callDataLength === 0) {
        return calldata;
    }

    if (callDataLength === 21) {
        if (numberOfExpectedArgs === 1 && method === 'polygon') {
            const n = rawCallData[0];
            const x = rawCallData.slice(1,11);
            const y = rawCallData.slice(11);

            calldata.push({ n, x, y });
        }
    }

    if (callDataLength === 16 ) {
        if (numberOfExpectedArgs === 1 && method === "main") {
            const first = rawCallData.slice(0,4) as string[];
            const second = rawCallData.slice(4,8) as string[];
            const third = rawCallData.slice(8,12) as string[];
            const fourth = rawCallData.slice(12) as string[];
    
    
            calldata.push([first, second, third, fourth]);
        }
    }

    // length 14 calldata
    if (callDataLength === 14) {
        if (numberOfExpectedArgs === 2) {
            calldata.push(rawCallData.slice(0, 10));
            calldata.push(rawCallData.slice(10));
        }
    }

    // length 13 calldata
    if (callDataLength === 13) {
        if (numberOfExpectedArgs === 4 && (method === "mergeSort" || method === "quickSort")) {
           calldata.push(rawCallData.slice(0,10));
           calldata.push(rawCallData[10]);
           calldata.push(rawCallData[11]);
           calldata.push(rawCallData[12]);
        }
    }
    
    // length 12 calldata 
    if (callDataLength === 12) {
        if (numberOfExpectedArgs === 3) {
            calldata.push(rawCallData.slice(0, 10));
            calldata.push(rawCallData[10]);
            calldata.push(rawCallData[11]);
        }
    }

    // length 11 calldata
    if (callDataLength === 11) {
        if (numberOfExpectedArgs === 3 && (method === "main" && filePath.includes("store_load_nested_witness_array_witness_index"))) {
            const first = rawCallData.slice(0,3) as string[];
            const second = rawCallData.slice(3,6) as string[];
            const third = rawCallData.slice(6,9) as string[];

            calldata.push([first, second, third]);
            calldata.push(rawCallData[9]);
            calldata.push(rawCallData[10]);
        } else if (numberOfExpectedArgs === 2) {
            const second = rawCallData[10];
            calldata.push(rawCallData.slice(0,10));
            calldata.push(second);
        } else if (numberOfExpectedArgs === 1) {
            if (filePath.includes("tuple")) {
                calldata.push(...rawCallData);
            } else {
                calldata.push(...rawCallData.slice(0,10));
            }
        }
    }

    // length 10 calldata
    if (callDataLength === 10) {
        if (numberOfExpectedArgs === 1) {
            calldata.push(...rawCallData);
        }
    }

    // length 2 or 7 calldata
    if (callDataLength === 2 || callDataLength === 7) {
       for (let i = 0; i < callDataLength; i++) {
            calldata.push(rawCallData[i]);
       }
    }

    // length 6 calldata
    if (callDataLength === 6) {
        if (numberOfExpectedArgs === 2 && method === "main") {
            calldata.push(rawCallData.slice(0, 5));
            calldata.push(rawCallData[5]);
        } else {
            for (let i = 0; i < callDataLength; i++) {
                calldata.push(rawCallData[i]);
            }                
        }
    }

    // length 5 calldata
    if (callDataLength === 5) {
        if (numberOfExpectedArgs === 2) {
            if (method === "main") {
                calldata.push(rawCallData.slice(0, 4));
                calldata.push(rawCallData[4]);
            }  else if (method === "distancePointEntry") {
                calldata.push({
                    a: rawCallData[0],
                    b: rawCallData[1],
                    c: rawCallData[2]
                });
    
                calldata.push({
                    x: rawCallData[3],
                    y: rawCallData[4]
                });
            }
        } else if (method === "twelve") {
            calldata.push(...rawCallData.slice(0, 3));
        } else {
            for (let i = 0; i < callDataLength; i++) {
                calldata.push(rawCallData[i]);
            }     
        }
    }

    // length 4 calldata
    if (callDataLength === 4) {
       if (numberOfExpectedArgs === 2 && method === "main") {
            if (filePath.includes("nested_gates_mutating")) {
                const bool1 = rawCallData[0] === '0' ? false : true;
                const bool2 = rawCallData[1] === '0' ? false : true;
                const bool3 = rawCallData[2] === '0' ? false : true;

                calldata.push([bool1, bool2, bool3], rawCallData[3])
            } else if (filePath.includes("mutating_complex")) {
                const witness = rawCallData[0] === '0' ? false : true
                const condition = rawCallData[3] === '0' ? false : true;
                
                calldata.push({a: witness, b: rawCallData[1], c: rawCallData[2]});
                calldata.push(condition);
            }
        } else {
            for (let i = 0; i < callDataLength; i++) {
                calldata.push(rawCallData[i]);
            }   
        }
    }

    // length 3 calldata
    if (callDataLength === 3) {
        if ((filePath.includes("structure_immutable_method.sol") || filePath.includes("structure_mutable_method.sol")) && testCaseName === "main") {
            const structArg = {
                a: rawCallData[0],
                b: rawCallData[1],
                c: rawCallData[2],
            };
            calldata.push(structArg);
        } else if (filePath.includes("nested_gates")) {
            const bool1 = rawCallData[0] === '0' ? false : true;
            const bool2 = rawCallData[1] === '0' ? false : true;
            const bool3 = rawCallData[2] === '0' ? false : true;

            calldata.push([bool1, bool2, bool3]);
        } else if (numberOfExpectedArgs === 1 && method === "triangle") {
            const triangle = {
                a: rawCallData[0],
                b: rawCallData[1],
                c: rawCallData[2]
            };
            
            calldata.push(triangle);
        } else {
            for (let i = 0; i < callDataLength; i++) {
                calldata.push(rawCallData[i]);
            } 
        }
    }

    // length 1 calldata
    if (callDataLength === 1) {
        if (method === "main" && testCaseName.includes("condition")) {
            const arg = rawCallData[0] === '0' ? false : true;
            calldata.push(arg);
        } else if (method === 'sphere') {
           calldata.push({ r: rawCallData[0] });
    } else if (method === "cube") {
        calldata.push({ a: rawCallData[0] });
    } else if (filePath.includes("require.sol")) {
        const arg = rawCallData[0] === '0' ? false : true;
        calldata.push(arg);
    } else {
            calldata.push(rawCallData[0]);
        }
    }

    return calldata;
}

const skipTestCase = (testCaseInput: Input, testCaseName: string, filePath: string, skippedTests: any[]) => {
    if (
        filePath === "contracts/yul_instructions/basefee.sol"
       || filePath === "contracts/yul_instructions/blockhash.sol"
       || filePath === "contracts/yul_instructions/chainid.sol"
       || filePath === "contracts/yul_instructions/codecopy.sol"
       || filePath === "contracts/yul_instructions/codesize.sol"
       || filePath === "contracts/yul_instructions/coinbase.sol"
       || filePath === "contracts/yul_instructions/difficulty.sol"
       || filePath === "contracts/yul_instructions/gaslimit.sol"
       || filePath === "contracts/yul_instructions/gasprice.sol"
       || filePath === "contracts/yul_instructions/keccak256.sol"
       || (filePath === "contracts/yul_instructions/msize.sol" && testCaseName === "ordinar")
       || (filePath === "contracts/yul_instructions/number.sol" && testCaseName === "default")
       || filePath === "contracts/yul_instructions/origin.sol"
       || filePath === "contracts/yul_instructions/prevrandao.sol"
       || filePath === "contracts/yul_instructions/return.sol"
       || filePath === "contracts/yul_instructions/returndatacopy.sol"
       || (filePath === "contracts/yul_instructions/returndatasize.sol" && testCaseName === "initial" && testCaseInput.method === "initial")
       || filePath === "contracts/yul_instructions/revert.sol"
       || filePath === "contracts/yul_instructions/pop.sol"
       || filePath === "contracts/yul_instructions/sar.sol"
       || filePath === "contracts/yul_instructions/sdiv.sol"
       || filePath === "contracts/yul_instructions/selfbalance.sol"
       || filePath === "contracts/yul_instructions/smod.sol"
       || filePath === "contracts/yul_instructions/stop.sol"
       || filePath === "contracts/yul_instructions/timestamp.sol"
       || filePath.includes("contracts/fat_ptr")
       || filePath.includes("contracts/function")
       || filePath === "contracts/immutable/inheritance/immutables6_yul.sol"
   ) {
       console.log(`Skipped ${testCaseName} from ${filePath}`);
       skippedTests.push({filePath, testCaseName, method: testCaseInput.method, inputs: []});

       return true;
   }

   return false;
}

const processPassedTest = (filePath: string, passedTests: any[], testCaseName: string, method: string, calldata: Calldata | any[], expectedData?: any, result?: any) => {
    console.log(`%c Passed TestCase: ${testCaseName} from ${filePath}`, `color:green;`);
    if (expectedData && result) {
        passedTests.push({filePath, testCaseName, method, calldata, expected: expectedData, result});
    } else {
        passedTests.push({filePath, testCaseName, method, calldata});
    }
}