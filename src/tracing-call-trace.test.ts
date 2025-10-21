import {
    getByteCode,
    getEnv,
    memoized,
    memoizedTx,
    sanitizeOpts as opts,
    visit,
    Visitor,
} from './util.ts'
import { assertSnapshot } from '@std/testing/snapshot'
import { expect } from '@std/expect'
import { encodeFunctionData, parseEther } from 'viem'
import { TracingCallerAbi } from '../codegen/abi/TracingCaller.ts'
import { TracingCalleeAbi } from '../codegen/abi/TracingCallee.ts'

// Initialize test environment
const env = await getEnv()

const TRACING_CALLEE_BYTECODE = getByteCode('TracingCallee', env.evm)

const getDeployTracingCalleeReceipt = memoizedTx(
    env,
    () =>
        env.accountWallet.deployContract({
            abi: TracingCalleeAbi,
            bytecode: TRACING_CALLEE_BYTECODE,
        }),
)

const getTracingCalleeAddr = () =>
    getDeployTracingCalleeReceipt().then((r) => r.contractAddress!)

const getTracingCallerAddr = memoized(async () => {
    const tracingCalleeAddr = await getTracingCalleeAddr()
    const hash = await env.accountWallet.deployContract({
        abi: TracingCallerAbi,
        args: [tracingCalleeAddr],
        bytecode: getByteCode('TracingCaller', env.evm),
        value: parseEther('10'),
    })
    const receipt = await env.accountWallet.waitForTransactionReceipt(hash)
    return receipt.contractAddress!
})

const getStartReceipt = memoized(async () => {
    const tracingCallerAddr = await getTracingCallerAddr()
    const { request } = await env.accountWallet.simulateContract({
        address: tracingCallerAddr,
        abi: TracingCallerAbi,
        functionName: 'start',
        args: [2n],
    })
    const hash = await env.accountWallet.writeContract(request)
    return await env.accountWallet.waitForTransactionReceipt(hash)
})

const getCreateReceipt = memoized(async () => {
    const tracingCallerAddr = await getTracingCallerAddr()
    const { request } = await env.accountWallet.simulateContract({
        address: tracingCallerAddr,
        abi: TracingCallerAbi,
        functionName: 'create',
    })
    const hash = await env.accountWallet.writeContract(request)
    return await env.accountWallet.waitForTransactionReceipt(hash)
})

const getCreate2Receipt = memoized(async () => {
    const tracingCallerAddr = await getTracingCallerAddr()
    const { request } = await env.accountWallet.simulateContract({
        address: tracingCallerAddr,
        abi: TracingCallerAbi,
        functionName: 'create2',
    })
    const hash = await env.accountWallet.writeContract(request)
    return await env.accountWallet.waitForTransactionReceipt(hash)
})

const getVisitor = async (): Promise<Visitor> => {
    const tracingCallerAddr = await getTracingCallerAddr()
    const tracingCalleeAddr = await getTracingCalleeAddr()
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
    const visitor = await getVisitor()

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
    const startReceipt = await getStartReceipt()
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
    const deployTracingCalleeReceipt = await getDeployTracingCalleeReceipt()
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
    const createReceipt = await getCreateReceipt()
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
    const create2Receipt = await getCreate2Receipt()
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
    const startReceipt = await getStartReceipt()
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
    const tracingCallerAddr = await getTracingCallerAddr()
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
