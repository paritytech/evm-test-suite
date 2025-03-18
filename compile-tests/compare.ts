import * as fs from 'fs';

interface Contract {
    bytecodeHash: string;
    solcVersion: string;
    compilerConfig: string;
}

interface ContractsJSON {
    contracts: {
        [key: string]: Contract[];
    }[];
}

function readJsonFile(filePath: string): ContractsJSON {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function deepCompareBytecodeHash(files: ContractsJSON[]): void {
    if (files.length < 2) {
        console.log('At least two files are required to compare.');
        return;
    }

    for (let i = 0; i < files.length; i++) {
        for (let j = i + 1; j < files.length; j++) {
            console.log(`Comparing File ${i + 1} and File ${j + 1}`);
            compareFileBytecodeHashes(files[i], files[j]);
        }
    }
}

function compareFileBytecodeHashes(file1: ContractsJSON, file2: ContractsJSON): void {
    file1.contracts.forEach((contractGroup1) => {
        file2.contracts.forEach((contractGroup2) => {
            Object.keys(contractGroup1).forEach((contractPath) => {
                if (contractGroup2[contractPath]) {
                    const contracts1 = contractGroup1[contractPath];
                    const contracts2 = contractGroup2[contractPath];

                    const contractMap2 = new Map<string, Contract>(
                        contracts2.map((contract) => [contract.bytecodeHash, contract])
                    );

                    contracts1.forEach((contract1, contractIndex1) => {
                        const matchingContract2 = contractMap2.get(contract1.bytecodeHash);

                        if (matchingContract2) {
                            console.log(
                                `Assertion passed: Contract bytecodeHash matched for ${contractPath} at index ${contractIndex1}.\n` +
                                `bytecodeHash: ${contract1.bytecodeHash}`
                            );
                        } else {
                            console.log(
                                `Assertion failed: Contract bytecodeHash mismatch for ${contractPath} at index ${contractIndex1}.\n` +
                                `File 1 bytecodeHash: ${contract1.bytecodeHash}, File 2 bytecodeHash: No matching contract`
                            );
                        }
                    });
                }
            });
        });
    });
}


const logDir = process.env.LOGS_DIR || '.';

const filePaths = [
    `${logDir}/win32JsonCompilationArtifacts.json`,
    `${logDir}/linuxJsonCompilationArtifacts.json`,
    `${logDir}/darwinJsonCompilationArtifacts.json`,
];

function runComparison(filePaths: string[]): void {
    const files: ContractsJSON[] = filePaths.map((filePath) => readJsonFile(filePath));

    deepCompareBytecodeHash(files);
}

runComparison(filePaths);

const filePaths2 = [
    `${logDir}/win32BinCompilationArtifacts.json`,
    `${logDir}/linuxBinCompilationArtifacts.json`,
    `${logDir}/darwinBinCompilationArtifacts.json`,
];

runComparison(filePaths2);
