import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';
import os from 'os';

type SolcInput = {
    [contractName: string]: {
        content: string
    }
}

type SolcOutput = {
    contracts: {
        [contractPath: string]: {
            [contractName: string]: {
                abi: Array<{
                    name: string
                    inputs: Array<{ name: string; type: string }>
                    outputs: Array<{ name: string; type: string }>
                    stateMutability: string
                    type: string
                }>
                evm: {
                    bytecode: { object: string }
                }
            }
        }
    }
    errors?: Array<SolcError>
}

type SolcError = {
    component: string
    errorCode: string
    formattedMessage: string
    message: string
    severity: string
    sourceLocation?: {
        file: string
        start: number
        end: number
    }
    type: string
}

type BinOutput = {
    [contractName: string]: {
        bytecode: string,
        errors: string
    },
}

const __filename = fileURLToPath(import.meta.url)
console.log(__filename)
const __dirname = path.dirname(__filename)
const contractsDir = join(__dirname, '../matter-labs-tests/contracts')
const binArtifacts: { contracts: BinOutput[] } = {
    contracts: []
}
const jsonArtifacts: { contracts: BinOutput[] } = {
    contracts: []
};

const platform = os.platform();

function tryResolveJsonImport(importPath: string) {
    // resolve local path
    if (existsSync(importPath)) {
        return path.resolve(importPath)
    }

    const importRegex = /^(@?[^@/]+(?:\/[^@/]+)?)(?:@([^/]+))?(\/.+)$/
    // const alternativeRegex = /^import\s+["'](.*)["'];$/;
    const match = importPath.match(importRegex)

    if (!match) {
        throw new Error('Invalid import path format.')
    }

    const basePackage = match[1] // "foo", "@scope/foo"
    const specifiedVersion = match[2] // "1.2.3" (optional)
    const relativePath = match[3] // "/path/to/file.sol"

    let packageJsonPath
    try {
        packageJsonPath = require.resolve(
            path.join(basePackage, 'package.json')
        )
    } catch {
        throw new Error(`Could not resolve package ${basePackage}`)
    }

    // Check if a version was specified and compare with the installed version
    if (specifiedVersion) {
        const installedVersion = JSON.parse(
            readFileSync(packageJsonPath, 'utf-8')
        ).version

        if (installedVersion !== specifiedVersion) {
            throw new Error(
                `Version mismatch: Specified ${basePackage}@${specifiedVersion}, but installed version is ${installedVersion}`
            )
        }
    }

    const packageRoot = path.dirname(packageJsonPath)

    // Construct full path to the requested file
    const resolvedPath = path.join(packageRoot, relativePath)
    if (existsSync(resolvedPath)) {
        return resolvedPath
    } else {
        throw new Error(`Resolved path ${resolvedPath} does not exist.`)
    }
}

function resolveInputs(sources: SolcInput): SolcInput {
    const input = {
        language: 'Solidity',
        sources,
        settings: {
            outputSelection: {
                '*': {
                    '*': ['evm.bytecode.object'],
                },
            },
        },
    }

    const out = solc.compile(JSON.stringify(input), {
        import: (path: string) => {
            try {
                const imp = tryResolveJsonImport(join(contractsDir, path));
                return {
                    contents: readFileSync(imp, 'utf8'),
                }
            } catch (error) {
                return {
                    path: `${path}`,
                    error: `${error}`
                }
            }
        },
    })

    const output = JSON.parse(out) as {
        sources: { [fileName: string]: { id: number } }
        errors: Array<SolcError>
    }

    if (output.errors) {
        throw new Error(output.errors[0].formattedMessage)
    }

    return Object.fromEntries(
        Object.keys(output.sources).map((fileName) => {
            return [
                fileName,
                sources[fileName] ?? {
                    content: readFileSync(tryResolveJsonImport(join(contractsDir, fileName)), 'utf8'),
                },
            ]
        })
    )
}

function resolveBinOutput(output?: string): BinOutput | undefined {
    if (output) {
        const splitted = output.split(" ");
        const resolvedOutput: BinOutput = {
            [splitted[1].replace(/`/g, '').split(contractsDir)[1]]: {
                bytecode: splitted[3].split("\n")[0],
                errors: ''
            }
        };
        binArtifacts.contracts.push(resolvedOutput)
        return resolvedOutput
    } else {
        return undefined
    }

}

function resolveJsonOutput(filePath: string, output?: SolcOutput): BinOutput | undefined {
    if (output) {
        for (const contractPath in output.contracts) {
            const contractInfo = output.contracts[contractPath];
            for (const contract in contractInfo) {
                if (path.basename(contractPath) === path.basename(filePath)) {
                    const resolvedOutput: BinOutput = {
                        [`${contractPath}:${contract}`]: {
                            bytecode: contractInfo[contract].evm.bytecode.object,
                            errors: ''
                        }
                    }
                    jsonArtifacts.contracts.push(resolvedOutput)
                }
            }
        }
    } else {
        return undefined
    }

}

function getFiles(dir: string, files_?: string[]): string[] {
    files_ = files_ || [];
    var files = readdirSync(dir);
    for (var i in files) {
        var name = dir + '/' + files[i];
        if (statSync(name).isDirectory()) {
            getFiles(name, files_);
        } else if (name.slice(-4) === '.sol') {
            files_.push(name);
        }
    }
    return files_;
}

function checkForSplitsources(filePath: string): string[] {
    const f = readFileSync(filePath, 'utf-8');
    const fullPath: string[] = [];
    const imports = extractImports(filePath);
    fullPath.push(...imports)
    return fullPath;
}

function compilePvmWithJson(filePath: string, input: string): PromiseLike<SolcOutput> {
    return new Promise((resolve, reject) => {
        const process = spawn('resolc', ['--standard-json'])

        let output = ''
        let error = ''

        process.stdin.write(input)
        process.stdin.end()

        process.stdout.on('data', (data) => {
            output += data.toString()
        })

        process.stderr.on('data', (data) => {
            error += data.toString()
        })

        process.on('close', (code) => {
            if (code === 0) {
                try {
                    const result: SolcOutput = JSON.parse(output)
                    resolveJsonOutput(filePath, result);
                    resolve(result)
                } catch {
                    console.log(`Failed to parse output`)
                }
            } else {
                const resolvedOutput: BinOutput = {
                    [filePath]: {
                        bytecode: '',
                        errors: `PHASE 2 ${error}`
                    }
                };
                jsonArtifacts.contracts.push(resolvedOutput)
                reject(console.log(`Process exited with code ${code}: ${error}`))
            }
        })
    })
}

function compilePvmWithBin(filePath: string): PromiseLike<void> {
    let imports: string[] = [];
    try {
        imports.push(...checkForSplitsources(filePath));

    } catch (error) {
        const resolvedOutput: BinOutput = {
            [filePath.split(contractsDir)[1]]: {
                bytecode: '',
                errors: `PHASE 3 ${error}`
            }
        };
        binArtifacts.contracts.push(resolvedOutput);
        throw error;
    }

    return new Promise((resolve, reject) => {
        const process = spawn('resolc', ['--bin', `${filePath}`, ...imports])

        let output = ''
        let error = ''
        process.stdin.end()

        process.stdout.on('data', (data) => {
            output += data.toString()
        })

        process.stderr.on('data', (data) => {
            error += data.toString()
        })

        process.on('close', (code) => {
            if (code === 0) {
                try {
                    resolveBinOutput(output)
                    resolve()
                } catch {
                    console.log(`Failed to parse output`)
                }
            } else {
                const resolvedOutput: BinOutput = {
                    [filePath.split(contractsDir)[1]]: {
                        bytecode: '',
                        errors: ` PHASE 4 ${error}`
                    }
                };
                binArtifacts.contracts.push(resolvedOutput)
                reject(console.log(`Process exited with code ${code}: ${error}`))
            }
        })
    })
}

function extractImports(filePath: string): string[] {

    const fileContent = readFileSync(`${filePath}`, 'utf-8')

    const importRegex =
        /import\s+(?:"([^"]+)"|'([^']+)'|(?:[^'"]+)\s+from\s+(?:"([^"]+)"|'([^']+)'))\s*;/g;
    let match: RegExpExecArray | null;

    let deduplicated: string[] = [];

    while ((match = importRegex.exec(fileContent)) !== null) {
        const importedPath = match[1] || match[2] || match[3] || match[4];
        if (importedPath) {
            let imports: string[] = [];
            const dir = path.dirname(filePath);
            const importPath = path.join(dir, importedPath)
            imports.push(importPath);
            for (let index in imports) {
                const dependencies = extractImports(imports[index]);
                imports.push(...dependencies)
            }
            let s = new Set(imports);
            deduplicated.push(...s)
        }
    }
    return deduplicated;
}

const BATCH_SIZE = 16;

async function main(): Promise<void> {
    const start = Date.now();

    const files = getFiles(contractsDir);
    console.log('LENGTH ', files.length)

    const processInBatches = async (files: string[]) => {
        const batches: string[][] = [];
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            batches.push(files.slice(i, i + BATCH_SIZE));
        }
        console.log('BATCH', ...batches)
        console.log('BATCH LENGTH', batches.length)
        for (const batch of batches) {
            await Promise.all(batch.map(file => processFile(file)));
        }
    };

    const processFile = async (file: string) => {
        const content = readFileSync(file, 'utf8');
        const cont = {
            [file.slice(contractsDir.length + 1)]: { content: content }
        };

        try {
            const sources = resolveInputs(cont);
            const input = JSON.stringify({
                language: 'Solidity',
                sources,
                settings: {
                    optimizer: { enabled: true, runs: 200 },
                    outputSelection: {
                        '*': {
                            '*': ['abi'],
                        },
                    },
                },
            });

            await compilePvmWithJson(file, input);
        } catch (error) {
            console.log(`Error processing file ${file}:`, error);
        }
        try {

            await compilePvmWithBin(file);

        } catch (error) {
            console.log(`Error processing file ${file}:`, error);
        }
    };

    await processInBatches(files);

    writeFileSync(`${platform}JsonCompilationArtifacts.json`, JSON.stringify(jsonArtifacts), 'utf-8');
    writeFileSync(`${platform}BinCompilationArtifacts.json`, JSON.stringify(binArtifacts), 'utf-8');

}


main().catch((error) => {
    console.log(error);
});

