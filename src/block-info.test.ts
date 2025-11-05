import { CallReturnType, decodeFunctionResult, encodeFunctionData } from 'viem'
import {
    getByteCode,
    getEnv,
    memoizedTx,
    sanitizeOpts as opts,
} from './util.ts'
import { expect } from '@std/expect'
import { BlockInfoAbi } from '../codegen/abi/BlockInfo.ts'

// Initialize test environment
const env = await getEnv()

const getBlockInfoReceipt = memoizedTx(
    env,
    () =>
        env.serverWallet.deployContract({
            abi: BlockInfoAbi,
            bytecode: getByteCode('BlockInfo', env.evm),
        }),
)

const getBlockInfoAddr = () =>
    getBlockInfoReceipt().then((r) => r.contractAddress!)

Deno.test('eth_call with latest block tag', opts, async () => {
    const address = await getBlockInfoAddr()

    const latestBlock = await env.serverWallet.getBlock({ blockTag: 'latest' })

    const callReturn: CallReturnType = await env.serverWallet.call({
        to: address,
        data: encodeFunctionData({
            abi: BlockInfoAbi,
            functionName: 'blockInfo',
        }),
        blockTag: 'latest',
    })

    const [blockTimestamp, blockNumber] = decodeFunctionResult({
        abi: BlockInfoAbi,
        functionName: 'blockInfo',
        data: callReturn?.data!,
    })
    expect(blockNumber).toEqual(latestBlock.number)
    expect(blockTimestamp).toEqual(latestBlock.timestamp)
})

Deno.test('eth_call with pending block tag', opts, async () => {
    const address = await getBlockInfoAddr()

    const latestBlock = await env.serverWallet.getBlock({ blockTag: 'latest' })

    const callReturn: CallReturnType = await env.serverWallet.call({
        to: address,
        data: encodeFunctionData({
            abi: BlockInfoAbi,
            functionName: 'blockInfo',
        }),
        blockTag: 'pending',
    })

    const [blockTimestamp, blockNumber] = decodeFunctionResult({
        abi: BlockInfoAbi,
        functionName: 'blockInfo',
        data: callReturn?.data!,
    })

    expect(blockNumber).toEqual(latestBlock.number + 1n)
    expect(blockTimestamp).toBeGreaterThan(Number(latestBlock.timestamp))
})
