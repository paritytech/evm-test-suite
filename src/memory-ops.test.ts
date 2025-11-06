import { expect } from '@std/expect'
import { getByteCode, sanitizeOpts as opts } from './util.ts'
import { env } from './deploy_contracts.ts'
import { MemoryOpsAbi } from '../codegen/abi/MemoryOps.ts'
import {
    concat,
    encodeAbiParameters,
    encodeFunctionData,
    keccak256,
} from 'viem'

Deno.test(
    'MemoryOps',
    opts,
    async (t) => {
        const bytecode = getByteCode('MemoryOps', env.evm)
        const constructorArgs = [true] as const
        const hash = await env.serverWallet.deployContract({
            abi: MemoryOpsAbi,
            bytecode,
            args: constructorArgs,
        })
        const { contractAddress } = await env.serverWallet
            .waitForTransactionReceipt(hash)
        const address = contractAddress!

        function read(
            functionName: Readonly<
                | 'arg'
                | 'callDataCopyHash'
                | 'callDataLoad'
                | 'callDataSize'
                | 'codeCopyHash'
                | 'codeSize'
            >,
        ) {
            return env.serverWallet.readContract({
                address,
                abi: MemoryOpsAbi,
                functionName,
            })
        }
        await t.step('constructor', async () => {
            const encodedArgs = encodeAbiParameters(
                [{ type: 'bool' }],
                constructorArgs,
            )
            const initcodeSize = (bytecode.length - 2) / 2
            const constructorArgsSize = (encodedArgs.length - 2) / 2

            expect({
                arg: await read('arg'),
                codeSize: await read('codeSize'),
                callDataSize: await read('callDataSize'),
                callDataLoad: await read('callDataLoad'),
                codeCopyHash: await read('codeCopyHash'),
                callDataCopyHash: await read('callDataCopyHash'),
            }).toEqual({
                arg: true,
                codeSize: BigInt(initcodeSize + constructorArgsSize),
                callDataSize: 0n,
                callDataLoad:
                    '0x0000000000000000000000000000000000000000000000000000000000000000',
                codeCopyHash: keccak256(concat([bytecode, encodedArgs])),
                callDataCopyHash: keccak256('0x'),
            })
        })

        await t.step('call', async () => {
            const callArgs = [true] as const
            const txHash = await env.serverWallet.writeContract({
                address,
                abi: MemoryOpsAbi,
                functionName: 'call',
                args: callArgs,
            })
            await env.serverWallet.waitForTransactionReceipt(txHash)

            // Calculate expected values for regular function context
            const callData = encodeFunctionData({
                abi: MemoryOpsAbi,
                functionName: 'call',
                args: callArgs,
            })

            expect({
                arg: await read('arg'),
                callDataSize: await read('callDataSize'),
                callDataLoad: await read('callDataLoad'),
                callDataCopyHash: await read('callDataCopyHash'),
            }).toEqual({
                arg: true,
                callDataSize: BigInt((callData.length - 2) / 2),
                callDataLoad: callData.slice(0, 66) as `0x${string}`,
                callDataCopyHash: keccak256(callData),
            })
        })
    },
)
