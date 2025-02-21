/// <reference path="./solc.d.ts" />

import { compile, SolcOutput } from '@parity/revive'
import { format } from 'prettier'
import { parseArgs } from 'node:util'
import solc from 'solc'
import { Buffer } from 'node:buffer'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

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

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = join(__dirname, '..')
const contractsDir = join(rootDir, 'contracts')
const abiDir = join(rootDir, 'abi')
const pvmDir = join(rootDir, 'pvm')
const evmDir = join(rootDir, 'evm')

const input = readdirSync(contractsDir)
    .filter((f) => f.endsWith('.sol'))
    .filter((f) => !filter || f.includes(filter))

for (const file of input) {
    console.log(`🔨 Compiling ${file}...`)
    const name = basename(file)
    const input = {
        [name]: { content: readFileSync(join(contractsDir, file), 'utf8') },
    }

    if (!solcOnly) {
        console.log('Compiling with revive...')
        const reviveOut = await compile(input)

        for (const contracts of Object.values(reviveOut.contracts)) {
            for (const [name, contract] of Object.entries(contracts)) {
                console.log(`📜 Add PVM contract ${name}`)
                writeFileSync(
                    join(pvmDir, `${name}.polkavm`),
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
                join(evmDir, `${name}.bin`),
                Buffer.from(contract.evm.bytecode.object, 'hex')
            )

            const abi = contract.abi
            const abiName = `${name}Abi`
            writeFileSync(
                join(abiDir, `${name}.json`),
                JSON.stringify(abi, null, 2)
            )

            writeFileSync(
                join(abiDir, `${name}.ts`),
                await format(
                    `export const ${abiName} = ${JSON.stringify(abi, null, 2)} as const`,
                    {
                        parser: 'typescript',
                    }
                )
            )
        }
    }
}
