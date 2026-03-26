import { type Hex, hexToBigInt, hexToNumber, parseEther } from 'viem'
import { sanitizeOpts as opts } from './util.ts'
import { expect } from '@std/expect'
import { TesterAbi } from '../codegen/abi/Tester.ts'
import { EventExampleAbi } from '../codegen/abi/EventExample.ts'
import { env, getEventExampleAddr, getTesterAddr } from './deploy_contracts.ts'

const untypedRequest = (method: string, params?: unknown[]) =>
    // deno-lint-ignore no-explicit-any
    env.publicClient.request({ method, params } as any)

Deno.test('westend: eth_accounts and eth_chainId', opts, async () => {
    const addresses = (await untypedRequest('eth_accounts')) as string[]
    expect(addresses.length).toBeGreaterThanOrEqual(1)
    expect(addresses[0].toLowerCase()).toEqual(
        env.serverWallet.account.address.toLowerCase(),
    )

    const res = await env.publicClient.request({
        method: 'eth_chainId',
    })
    expect(hexToNumber(res)).toEqual(env.chain.id)
})

Deno.test(
    'westend: eth_gasPrice, eth_maxPriorityFeePerGas, eth_feeHistory',
    opts,
    async () => {
        const gasPrice = await env.publicClient.request({
            method: 'eth_gasPrice',
        })
        expect(hexToBigInt(gasPrice) > 0n).toBe(true)

        const maxPriority = await untypedRequest(
            'eth_maxPriorityFeePerGas',
        ) as Hex
        expect(hexToBigInt(maxPriority) >= 0n).toBe(true)

        const feeHistory = await env.publicClient.getFeeHistory({
            blockCount: 4,
            blockTag: 'latest',
            rewardPercentiles: [25, 75],
        })
        expect(feeHistory.gasUsedRatio.length).toBeGreaterThan(0)
        expect(feeHistory.baseFeePerGas).toBeTruthy()
    },
)

Deno.test(
    'westend: eth_getBlockByNumber and eth_getBlockByHash',
    opts,
    async () => {
        const earliest = await env.publicClient.getBlock({
            blockTag: 'earliest',
        })
        expect(earliest).toBeTruthy()
        expect(earliest.number).toEqual(0n)

        const byHash = await env.publicClient.getBlock({
            blockHash: earliest.hash!,
        })
        expect(byHash.number).toEqual(earliest.number)
        expect(byHash.timestamp).toEqual(earliest.timestamp)
    },
)

Deno.test('westend: eth_getCode and eth_getStorageAt', opts, async () => {
    const address = await getTesterAddr()

    const code = await env.publicClient.getCode({ address })
    expect(code).toBeTruthy()
    expect(code !== '0x').toBe(true)

    const storage = await env.serverWallet.getStorageAt({
        address,
        slot: '0x01',
    })
    expect(typeof storage).toEqual('string')
    expect(storage !== '0x').toBe(true)
})

Deno.test('westend: eth_call reads contract state', opts, async () => {
    const value = await env.serverWallet.readContract({
        address: await getTesterAddr(),
        abi: TesterAbi,
        functionName: 'value',
    })
    expect(value).toEqual(42n)
})

Deno.test(
    'westend: eth_estimateGas, eth_sendTransaction, eth_getTransactionByHash',
    opts,
    async () => {
        const txParams = {
            to: env.serverWallet.account.address,
            value: parseEther('0.01'),
        } as const

        const gas = await env.accountWallet.estimateGas(txParams)
        expect(gas > 0n).toBe(true)

        const hash = await env.accountWallet.sendTransaction(txParams)
        const receipt = await env.serverWallet.waitForTransactionReceipt(hash)
        expect(receipt.status).toEqual('success')

        const tx = await env.serverWallet.getTransaction({ hash })
        expect(tx).toBeTruthy()
        expect(tx.hash).toEqual(hash)
    },
)

Deno.test(
    'westend: eth_getLogs returns events from contract call',
    opts,
    async () => {
        const address = await getEventExampleAddr()
        const { request } = await env.serverWallet.simulateContract({
            address,
            abi: EventExampleAbi,
            functionName: 'triggerEvent',
        })
        const hash = await env.serverWallet.writeContract(request)
        const receipt = await env.serverWallet.waitForTransactionReceipt(hash)
        const logs = await env.publicClient.getLogs({
            address,
            blockHash: receipt.blockHash,
        })
        expect(logs.length).toBeGreaterThanOrEqual(1)
        expect(logs[0].transactionHash).toEqual(hash)
    },
)
