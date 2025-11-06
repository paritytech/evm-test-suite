import { expect } from '@std/expect'
import { getByteCode, sanitizeOpts as opts } from './util.ts'
import { env } from './deploy_contracts.ts'
import { MemoryOpsAbi } from '../codegen/abi/MemoryOps.ts'
import { concat, encodeAbiParameters, keccak256 } from 'viem'

Deno.test(
    'constructor MemoryOps',
    opts,
    async (t) => {
        const bytecode = getByteCode('MemoryOps', env.evm)
        const constructorArgs = [42n, 1337n, 'Hello Constructor'] as const
        const hash = await env.serverWallet.deployContract({
            abi: MemoryOpsAbi,
            bytecode,
            args: constructorArgs,
        })
        const { contractAddress } = await env.serverWallet
            .waitForTransactionReceipt(hash)
        const address = contractAddress!
        const encodedArgs = encodeAbiParameters(
            [
                { type: 'uint256' },
                { type: 'uint256' },
                { type: 'string' },
            ],
            constructorArgs,
        )

        await t.step('CODESIZE returns initcode++calldata length', async () => {
            // Calculate expected codeSize: initcode + encoded constructor args
            // Hex strings start with "0x", so subtract 2 chars before dividing by 2 to get byte length
            const initcodeSize = (bytecode.length - 2) / 2
            const constructorArgsSize = (encodedArgs.length - 2) / 2
            const expectedCodeSize = BigInt(initcodeSize + constructorArgsSize)
            const codeSize = await env.serverWallet.readContract({
                address,
                abi: MemoryOpsAbi,
                functionName: 'codeSize',
            })
            expect(codeSize).toEqual(expectedCodeSize)
        })

        await t.step('CODECOPY hash matches expected value', async () => {
            // Calculate expected hash: keccak256(initcode ++ encoded constructor args)
            const expectedHash = keccak256(concat([bytecode, encodedArgs]))
            const codeCopyHash = await env.serverWallet.readContract({
                address,
                abi: MemoryOpsAbi,
                functionName: 'codeCopyHash',
            })
            expect(codeCopyHash).toEqual(expectedHash)
        })

        await t.step('CALLDATASIZE returns 0 (empty buffer)', async () => {
            const callDataSize = await env.serverWallet.readContract({
                address,
                abi: MemoryOpsAbi,
                functionName: 'callDataSize',
            })
            expect(callDataSize).toEqual(0n)
        })

        await t.step('CALLDATALOAD returns 0 (empty buffer)', async () => {
            const callDataLoad = await env.serverWallet.readContract({
                address,
                abi: MemoryOpsAbi,
                functionName: 'callDataLoad',
            })
            expect(callDataLoad).toEqual(
                '0x0000000000000000000000000000000000000000000000000000000000000000',
            )
        })
    },
)
