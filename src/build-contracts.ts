/// <reference path="./solc.d.ts" />

import {
    compile,
    type SolcOutput,
    tryResolveImport,
    version,
} from '@parity/resolc'
import solc from 'solc'
import { basename, join } from '@std/path'

type CompileInput = Parameters<typeof compile>[0]

const args = Deno.args
const filter = args.includes('-f') || args.includes('--filter')
    ? args[args.indexOf('-f') + 1] || args[args.indexOf('--filter') + 1]
    : undefined
const solcOnly = args.includes('-s') || args.includes('--solcOnly')

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

    return solc.compile(JSON.stringify(input), {
        import: (relativePath: string) => {
            const source = Deno.readTextFileSync(tryResolveImport(relativePath))
            return { contents: source }
        },
    })
}

console.log('Compiling contracts...')

const currentDir = new URL('.', import.meta.url).pathname
const rootDir = join(currentDir, '..')
const contractsDir = join(rootDir, 'contracts')
const abiDir = join(rootDir, 'abi')
const pvmDir = join(rootDir, 'pvm')
const evmDir = join(rootDir, 'evm')

const input = Array.from(Deno.readDirSync(contractsDir))
    .filter((f) => f.isFile && f.name.endsWith('.sol'))
    .filter((f) => !filter || f.name.includes(filter))

for (const file of input) {
    console.log(`🔨 Compiling ${file.name}...`)
    const name = basename(file.name)
    const inputSources = {
        [name]: {
            content: Deno.readTextFileSync(join(contractsDir, file.name)),
        },
    }

    if (!solcOnly) {
        if (Deno.env.get('REVIVE_BIN') === undefined) {
            console.log(`Compiling with revive @parity/resolc: ${version()}...`)
        } else {
            // add the result of resolc --version

            const output = new TextDecoder().decode(
                (
                    await new Deno.Command('resolc', {
                        args: ['--version'],
                        stdout: 'piped',
                    }).output()
                ).stdout,
            )
            console.log(
                `Compiling with revive (using ${
                    Deno.env.get('REVIVE_BIN')
                } - ${output})...`,
            )
        }
        const reviveOut = await compile(inputSources, {
            bin: Deno.env.get('REVIVE_BIN'),
        })

        for (const contracts of Object.values(reviveOut.contracts)) {
            for (const [name, contract] of Object.entries(contracts)) {
                if (contract?.evm?.bytecode?.object) {
                    console.log(`📜 Add PVM contract ${name}`)
                    const bytecode = new Uint8Array(
                        contract.evm.bytecode.object
                            .match(/.{1,2}/g)!
                            .map((byte) => parseInt(byte, 16)),
                    )
                    Deno.writeFileSync(
                        join(pvmDir, `${name}.polkavm`),
                        bytecode,
                    )
                }
            }
        }
    }

    console.log(`Compile with solc ${file.name}`)
    const evmOut = JSON.parse(evmCompile(inputSources)) as SolcOutput

    if (evmOut.errors) {
        for (const error of evmOut.errors) {
            console.error(error.formattedMessage)
        }

        if (evmOut.errors.some((err) => err.severity !== 'warning')) {
            Deno.exit(1)
        }
    }

    for (const contracts of Object.values(evmOut.contracts)) {
        for (const [name, contract] of Object.entries(contracts)) {
            console.log(`📜 Add EVM contract ${name}`)

            // Only write bytecode if it exists and is not empty
            if (contract.evm?.bytecode?.object) {
                const bytecodeHex = contract.evm.bytecode.object
                if (bytecodeHex.length > 0) {
                    const bytecode = new Uint8Array(
                        bytecodeHex
                            .match(/.{1,2}/g)!
                            .map((byte) => parseInt(byte, 16)),
                    )
                    Deno.writeFileSync(join(evmDir, `${name}.bin`), bytecode)
                }
            }

            const abi = contract.abi
            const abiName = `${name}Abi`
            Deno.writeTextFileSync(
                join(abiDir, `${name}.json`),
                JSON.stringify(abi, null, 2),
            )

            // Format TypeScript file manually (simple formatting)
            const tsContent = `export const ${abiName} = ${
                JSON.stringify(
                    abi,
                    null,
                    2,
                )
            } as const\n`
            Deno.writeTextFileSync(join(abiDir, `${name}.ts`), tsContent)
        }
    }
}
