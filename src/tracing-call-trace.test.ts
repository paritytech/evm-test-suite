import { getByteCode, getEnv, visit, Visitor } from './util.ts'
import { assertSnapshot } from '@std/testing/snapshot'
import { expect } from '@std/expect'
import {
    encodeFunctionData,
    type Hex,
    parseEther,
    type TransactionReceipt,
} from 'viem'
import { TracingCallerAbi } from '../abi/TracingCaller.ts'
import { TracingCalleeAbi } from '../abi/TracingCallee.ts'
import { sanitizeOpts as opts } from './test-setup.ts'

// Initialize test environment
const env = await getEnv()

const TRACING_CALLEE_BYTECODE = getByteCode('TracingCallee', env.evm)
let deployTracingCalleeReceipt: TransactionReceipt
let tracingCalleeAddr: Hex
let tracingCallerAddr: Hex
let startReceipt: TransactionReceipt
let createReceipt: TransactionReceipt
let create2Receipt: TransactionReceipt

Deno.test.beforeAll(async () => {
    const hash1 = await env.accountWallet.deployContract({
        abi: TracingCalleeAbi,
        bytecode: TRACING_CALLEE_BYTECODE,
    })
    deployTracingCalleeReceipt = await env.accountWallet
        .waitForTransactionReceipt(
            hash1,
        )
    tracingCalleeAddr = deployTracingCalleeReceipt.contractAddress!

    const hash2 = await env.accountWallet.deployContract({
        abi: TracingCallerAbi,
        args: [tracingCalleeAddr],
        bytecode: getByteCode('TracingCaller', env.evm),
        value: parseEther('10'),
    })
    const receipt2 = await env.accountWallet.waitForTransactionReceipt(hash2)
    tracingCallerAddr = receipt2.contractAddress!

    const { request: startRequest } = await env.accountWallet.simulateContract({
        address: tracingCallerAddr,
        abi: TracingCallerAbi,
        functionName: 'start',
        args: [2n],
    })
    const startHash = await env.accountWallet.writeContract(startRequest)
    startReceipt = await env.accountWallet.waitForTransactionReceipt(startHash)

    const { request: createRequest } = await env.accountWallet.simulateContract(
        {
            address: tracingCallerAddr,
            abi: TracingCallerAbi,
            functionName: 'create',
        },
    )
    const createHash = await env.accountWallet.writeContract(createRequest)
    createReceipt = await env.accountWallet.waitForTransactionReceipt(
        createHash,
    )

    const { request: create2Request } = await env.accountWallet
        .simulateContract(
            {
                address: tracingCallerAddr,
                abi: TracingCallerAbi,
                functionName: 'create2',
            },
        )
    const create2Hash = await env.accountWallet.writeContract(create2Request)
    create2Receipt = await env.accountWallet.waitForTransactionReceipt(
        create2Hash,
    )
})

const getVisitor = (): Visitor => {
    return (key, value) => {
        switch (key) {
            case 'address':
            case 'from':
            case 'to': {
                if (value === tracingCallerAddr) {
                    return [key, '<contract_addr>']
                } else if (value === tracingCalleeAddr) {
                    return [key, '<contract_callee_addr>']
                } else if (
                    value == env.accountWallet.account.address.toLowerCase()
                ) {
                    return [key, '<caller>']
                }

                return [key, value]
            }
            case 'revertReason':
                return [
                    key,
                    typeof value === 'string' && value.startsWith('revert: ')
                        ? value.slice('revert: '.length)
                        : value,
                ]

            case 'gas':
            case 'gasUsed': {
                return [key, '0x42']
            }
            case 'txHash': {
                return [key, '<hash>']
            }
            case 'input': {
                return [
                    key,
                    value === TRACING_CALLEE_BYTECODE ? '<code>' : value,
                ]
            }
            default: {
                return [key, value]
            }
        }
    }
}

const matchFixture = async (
    t: Deno.TestContext,
    res: unknown,
    fixtureName: string,
) => {
    const visitor = getVisitor()

    if (Deno.env.get('DEBUG')) {
        const currentDir = new URL('.', import.meta.url).pathname
        const dir = `${currentDir}samples/call_tracer/`
        await Deno.mkdir(dir, { recursive: true })
        await Deno.writeTextFile(
            `${dir}${fixtureName}.${env.chain.name}.json`,
            JSON.stringify(res, null, 2),
        )
    }

    await assertSnapshot(t, visit(res, visitor), {
        name: fixtureName,
    })
}

Deno.test('debug_traceTransaction', opts, async (t) => {
    const res = await env.debugClient.traceTransaction(
        startReceipt.transactionHash,
        'callTracer',
        {
            withLog: true,
        },
    )
    await matchFixture(t, res, 'debug_traceTransaction')
})

Deno.test('debug_deploy_traceTransaction', opts, async (t) => {
    const res = await env.debugClient.traceTransaction(
        deployTracingCalleeReceipt.transactionHash,
        'callTracer',
        {
            withLog: true,
        },
    )

    // We don't have runtime code output in revive
    delete (res as Record<string, unknown>).output
    await matchFixture(t, res, 'debug_deploy_traceTransaction')
})

Deno.test('debug_create', opts, async () => {
    const res = await env.debugClient.traceTransaction(
        createReceipt.transactionHash,
        'callTracer',
        {
            withLog: true,
        },
    )

    const resData = res as {
        calls: Array<{ type: string; to: `0x${string}` }>
    }
    expect(resData.calls[0].type).toEqual('CREATE')
    const code = await env.serverWallet.getCode({
        address: resData.calls[0].to,
    })
    expect(code).toBeTruthy()
})

Deno.test('debug_create2', opts, async () => {
    const res = await env.debugClient.traceTransaction(
        create2Receipt.transactionHash,
        'callTracer',
        {
            withLog: true,
        },
    )
    const resData = res as {
        calls: Array<{ type: string; to: `0x${string}` }>
    }
    expect(resData.calls[0].type).toEqual('CREATE2')
    const code = await env.serverWallet.getCode({
        address: resData.calls[0].to,
    })
    expect(code).toBeTruthy()
})

Deno.test('debug_traceBlock', opts, async (t) => {
    const res = await env.debugClient.traceBlock(
        startReceipt.blockNumber,
        'callTracer',
        {
            withLog: true,
        },
    )
    await matchFixture(t, res, 'debug_traceBlock')
})

Deno.test('debug_traceCall', opts, async (t) => {
    const res = await env.debugClient.traceCall(
        {
            to: tracingCallerAddr,
            data: encodeFunctionData({
                abi: TracingCallerAbi,
                functionName: 'start',
                args: [2n],
            }),
        },
        'callTracer',
        { withLog: true },
    )

    await matchFixture(t, res, 'debug_traceCall')
})
