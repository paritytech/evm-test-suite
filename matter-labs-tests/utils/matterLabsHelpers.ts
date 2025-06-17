import fs from 'fs';
import readline from 'readline';

import { Input, Metadata } from '../types';

const SIMPLE_TESTS_INSTANCE = "Test";

export const matterLabsMetadataFromStr = async (filePath: string): Promise<Metadata> => {
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

const addFileMetadata = async (filePath: string, filePathData: {filePath: string, metadata: Metadata}[]) => {
    const metadata = await matterLabsMetadataFromStr(filePath);
    filePathData.push({filePath, metadata});
}

export const getMatterLabsFilePaths = async (filePath: string, filePathData: {filePath: string, metadata: Metadata}[], filters?: string[]) => {
    if (fs.lstatSync(filePath).isDirectory()) {
        const filePaths = await fs.promises.readdir(filePath);

        for (const file of filePaths) {
            const fileName = `${filePath}/${file}`;
            await getMatterLabsFilePaths(fileName, filePathData, filters);
        }
    } else {
        if (filePath.includes(".sol")) {
            if (filePath.startsWith(".")) {
                return;
            }

            if (filters) {
                // console.log("FILE PATH---", filePath)
                for (const filter of filters) {
                    console.log("filter---", filter)
                    console.log("FILEPATH---", filePath)
                    console.log("DOES IT INCLUDE?---", filePath.includes(filter))
                    if (filePath.includes(filter)) {
                        await addFileMetadata(filePath, filePathData);
                    }
                }
            } else {
                await addFileMetadata(filePath, filePathData);
            }

        }
    }
}

export const MATTER_LABS_SIMPLE_TESTS_PATH = `contracts/era-compiler-tests/solidity/simple`;

export const whiteListTestCase = (testCaseInput: Input, testCaseName: string, filePath: string): boolean => {
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
        return true;
    }

    return false;
}
