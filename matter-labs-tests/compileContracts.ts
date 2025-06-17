import { compile, SolcOutput } from '@parity/revive'
import { format } from 'prettier'
import { parseArgs } from 'node:util'
import solc from 'solc'
import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, join } from 'path'

import dotenv from 'dotenv';
dotenv.config();

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getMatterLabsFilePaths } from './utils/matterLabsHelpers'
import { Metadata } from './types'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type CompileInput = Parameters<typeof compile>[0]

const {
    values: { filter, solcOnly },
} = parseArgs({
    args: process.argv.slice(2),
    options: {
        filter: {
            type: 'string',
            short: 'f',
        },
        solcOnly: {
            type: 'boolean',
            short: 's',
        },
    },
})

function evmCompile(sources: CompileInput) {
    const input = {
        language: 'Solidity',
        sources,
        settings: {
            outputSelection: {
                '*': {
                    '*': ['*'],
                },
            },
        },
    }

    return solc.compile(JSON.stringify(input))
}

console.log('Compiling contracts...')

const contractsDirectory = 'contracts/era-compiler-tests/solidity/simple';
const rootDir = join(__dirname, '.')
const contractsDir = join(rootDir, contractsDirectory)
const abiDir = join(rootDir, 'abi')
const pvmDir = join(rootDir, 'pvm')
const evmDir = join(rootDir, 'evm')

const input = readdirSync(contractsDir)
    .filter((f) => f.endsWith('.sol'))
    .filter((f) => !filter || f.includes(filter))

const filePaths: { filePath: string, metadata: Metadata }[] = [];

const filters = process.env.CONTRACT_FILTERS?.split(',') || [];
await getMatterLabsFilePaths(contractsDir, filePaths, filters);

for (const data of filePaths) {
    const file = data.filePath;

    const lastSlashIndex = file.lastIndexOf('/');
    const lastSegment = file.substring(0, lastSlashIndex);
    const fileDirInfo = lastSegment.split('/').pop() || '';

    console.log(`🔨 Compiling ${file}...`)
    const fileName = basename(file, '.sol')
    const input = {
        [fileName]: { content: readFileSync(file, 'utf8') },
    }

    if (!solcOnly) {
        console.log('Compiling with revive...')
        const reviveOut = await compile(input, { bin: 'resolc' })

        for (const contracts of Object.values(reviveOut.contracts)) {
            console.log("contracts----", contracts)
            for (let [name, contract] of Object.entries(contracts)) {
                console.log(`📜 Add PVM contract ${name}`)
                writeFileSync(
                    join(pvmDir, `${fileDirInfo}:${fileName}:${name}.polkavm`),
                    Buffer.from(contract.evm.bytecode.object, 'hex')
                )
            }
        }
    }

    console.log(`Compile with solc ${file}`)
    const evmOut = JSON.parse(evmCompile(input)) as SolcOutput

    for (const contracts of Object.values(evmOut.contracts)) {
        for (const [name, contract] of Object.entries(contracts)) {
            console.log(`📜 Add EVM contract ${name}`)
            writeFileSync(
                join(evmDir, `${fileDirInfo}:${fileName}:${name}.bin`),
                Buffer.from(contract.evm.bytecode.object, 'hex')
            )

            const abi = contract.abi
            const abiName = `${name}Abi`
            writeFileSync(join(abiDir, `${fileDirInfo}:${fileName}:${name}.json`), JSON.stringify(abi, null, 2))

            writeFileSync(
                join(abiDir, `${fileDirInfo}:${fileName}:${name}.ts`),
                await format(`export const ${abiName} = ${JSON.stringify(abi, null, 2)} as const`, {
                    parser: 'typescript',
                })
            )
        }
    }
}
