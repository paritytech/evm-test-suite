import {
    getByteCode,
    getEnv,
    jsonRpcErrors,
    memoizedDeploy,
    sanitizeOpts as opts,
} from './util.ts'
import { expect } from '@std/expect'
import { decodeEventLog, encodeFunctionData, parseEther } from 'viem'
import { ErrorsAbi } from '../abi/Errors.ts'
import { EventExampleAbi } from '../abi/EventExample.ts'
import { ReturnDataTesterAbi } from '../abi/ReturnDataTester.ts'

// Initialize test environment
const env = await getEnv()

const getErrorTesterAddr = memoizedDeploy(env, () =>
    env.serverWallet.deployContract({
        abi: ErrorsAbi,
        bytecode: getByteCode('Errors', env.evm),
    })
)

const getEventExampleAddr = memoizedDeploy(env, () =>
    env.serverWallet.deployContract({
        abi: EventExampleAbi,
        bytecode: getByteCode('EventExample', env.evm),
    })
)

const getReturnDataTesterAddr = memoizedDeploy(env, () =>
    env.serverWallet.deployContract({
        abi: ReturnDataTesterAbi,
        bytecode: getByteCode('ReturnDataTester', env.evm),
    })
)

Deno.test('eth_call with insufficient funds', opts, async () => {
    try {
        await env.emptyWallet.simulateContract({
            address: await getErrorTesterAddr(),
            abi: ErrorsAbi,
            functionName: 'valueMatch',
            value: parseEther('10'),
            args: [parseEther('10')],
        })
        throw new Error('Expect call to fail')
    } catch (_) {
        const lastJsonRpcError = jsonRpcErrors.pop()
        expect(lastJsonRpcError?.code).toBe(-32000)
        expect(lastJsonRpcError?.message).toContain('insufficient funds')
        expect(lastJsonRpcError?.data).toBeUndefined()
    }
})

Deno.test('eth_call transfer with insufficient funds', opts, async () => {
    const value = parseEther('10')
    const balance = await env.emptyWallet.getBalance(env.emptyWallet.account)
    if (balance >= value) {
        throw new Error('Balance should be less than 10')
    }
    try {
        await env.emptyWallet.sendTransaction({
            to: '0x75E480dB528101a381Ce68544611C169Ad7EB342',
            value,
        })
        throw new Error('Expect call to fail')
    } catch (_) {
        const lastJsonRpcError = jsonRpcErrors.pop()
        expect(lastJsonRpcError?.code).toBe(-32000)
        expect(lastJsonRpcError?.message).toContain('insufficient funds')
        expect(lastJsonRpcError?.data).toBeUndefined()
    }
})

Deno.test('eth_estimate with insufficient funds', opts, async () => {
    try {
        await env.emptyWallet.estimateContractGas({
            address: await getErrorTesterAddr(),
            abi: ErrorsAbi,
            functionName: 'valueMatch',
            value: parseEther('10'),
            args: [parseEther('10')],
        })
        throw new Error('Expect call to fail')
    } catch (_err) {
        const lastJsonRpcError = jsonRpcErrors.pop()
        expect(lastJsonRpcError?.code).toBe(-32000)
        expect(lastJsonRpcError?.message).toContain('insufficient funds')
        expect(lastJsonRpcError?.data).toBeUndefined()
    }
})

Deno.test(
    'eth_estimate call caller with insufficient funds',
    opts,
    async () => {
        try {
            await env.emptyWallet.estimateContractGas({
                address: await getErrorTesterAddr(),
                abi: ErrorsAbi,
                functionName: 'valueMatch',
                value: parseEther('10'),
                args: [parseEther('10')],
            })
            throw new Error('Expect call to fail')
        } catch (_err) {
            const lastJsonRpcError = jsonRpcErrors.pop()
            expect(lastJsonRpcError?.code).toBe(-32000)
            expect(lastJsonRpcError?.message).toContain('insufficient funds')
            expect(lastJsonRpcError?.data).toBeUndefined()
        }
    }
)

Deno.test('eth_estimate with revert', opts, async () => {
    try {
        await env.serverWallet.estimateContractGas({
            address: await getErrorTesterAddr(),
            abi: ErrorsAbi,
            functionName: 'valueMatch',
            value: parseEther('11'),
            args: [parseEther('10')],
        })
        throw new Error('Expect call to fail')
    } catch (_err) {
        const lastJsonRpcError = jsonRpcErrors.pop()
        expect(lastJsonRpcError?.code).toBe(3)
        expect([
            'execution reverted: msg.value does not match value',
            'execution reverted: revert: msg.value does not match value',
        ]).toContain(lastJsonRpcError?.message)
        expect(lastJsonRpcError?.data).toBe(
            '0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001e6d73672e76616c756520646f6573206e6f74206d617463682076616c75650000'
        )
    }
})

Deno.test('eth_get_balance with no account', opts, async () => {
    const balance = await env.serverWallet.getBalance({
        address: '0x0000000000000000000000000000000000000123',
    })
    expect(balance).toBe(0n)
})

Deno.test(
    'eth_estimate with insufficient funds to cover gas',
    opts,
    async () => {
        const balance = await env.serverWallet.getBalance(
            env.emptyWallet.account
        )
        expect(balance).toBe(0n)
        try {
            await env.emptyWallet.estimateContractGas({
                address: await getErrorTesterAddr(),
                abi: ErrorsAbi,
                functionName: 'setState',
                args: [true],
            })
            throw new Error('Expect call to fail')
        } catch (_err) {
            const lastJsonRpcError = jsonRpcErrors.pop()
            expect(lastJsonRpcError?.code).toBe(-32000)
            expect(lastJsonRpcError?.message).toContain('insufficient funds')
            expect(lastJsonRpcError?.data).toBeUndefined()
        }
    }
)

Deno.test('eth_estimate with no gas specified', opts, async () => {
    const balance = await env.serverWallet.getBalance(env.emptyWallet.account)
    expect(balance).toBe(0n)

    const data = encodeFunctionData({
        abi: ErrorsAbi,
        functionName: 'setState',
        args: [true],
    })

    await env.emptyWallet.request({
        method: 'eth_estimateGas',
        params: [
            {
                data,
                from: env.emptyWallet.account.address,
                to: await getErrorTesterAddr(),
            },
        ],
    })
})

Deno.test('logs', opts, async () => {
    const address = await getEventExampleAddr()
    const { request } = await env.serverWallet.simulateContract({
        address,
        abi: EventExampleAbi,
        functionName: 'triggerEvent',
    })

    const hash = await env.serverWallet.writeContract(request)
    const receipt = await env.serverWallet.waitForTransactionReceipt(hash)
    const logs = await env.serverWallet.getLogs({
        address,
        blockHash: receipt.blockHash,
    })
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
        address,
        data: '0x00000000000000000000000000000000000000000000000000000000000030390000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000b48656c6c6f20776f726c64000000000000000000000000000000000000000000',
        transactionHash: hash,
    })

    expect(
        decodeEventLog({
            abi: EventExampleAbi,
            data: logs[0].data,
            topics: logs[0].topics,
        })
    ).toEqual({
        eventName: 'ExampleEvent',
        args: {
            sender: env.serverWallet.account.address,
            value: 12345n,
            message: 'Hello world',
        },
    })
})

Deno.test('returndata_works', opts, async () => {
    if (!env.evm) {
        console.warn(
            "Skip this test on PVM, as it doesn't support instantiating a child contract whose code is not yet on-chain."
        )
        return
    }

    // 1. deploy ReturnDataTester contract and get its address
    const address = await getReturnDataTesterAddr()

    // 2. call createChildContract to create a child contract
    const { request } = await env.serverWallet.simulateContract({
        address,
        abi: ReturnDataTesterAbi,
        functionName: 'createChildContract',
    })
    const hash = await env.serverWallet.writeContract(request)
    const receipt = await env.serverWallet.waitForTransactionReceipt(hash)
    expect(receipt.status).toEqual('success')

    // 3. call getCapturedReturnDataSize to get the recorded return data size
    const dataSize = await env.emptyWallet.readContract({
        address: address,
        abi: ReturnDataTesterAbi,
        functionName: 'getCapturedReturnDataSize',
        args: [],
    })

    expect(dataSize).toBe(0n)
})

Deno.test('eth_call_deployment_returns_bytecode', opts, async () => {
    const result = await env.serverWallet.call({
        data: getByteCode('Errors', env.evm),
    })

    expect(typeof result).toBe('object')
    if (env.evm) {
        expect(result).not.toBeNull()
        expect('data' in result).toBe(true)
        expect(typeof result.data).toBe('string')
        const data = result['data']
        if (typeof data !== 'string') {
            throw new Error(`expected result.data to be string, got ${typeof data}`)
        }

        // hex string; '0xDDDD...'
        expect(data.startsWith('0x')).toBe(true)
        expect(data.length).toBeGreaterThan(2)
    } else {
        //TODO: Is fix required for PVM ?
        expect(result).toEqual({})
    }
})