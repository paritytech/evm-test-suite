import { encodeFunctionData } from 'viem'
import { FlipperAbi } from '../codegen/abi/Flipper.ts'
import {
    env,
    getFlipperContractAddr,
    getFlipperReceipt,
} from './deploy_contracts.ts'
import { sanitizeOpts as opts, visit, type Visitor } from './util.ts'
import { assertSnapshot } from '@std/testing/snapshot'

interface StructLog {
    depth: number
    gas: number
    gasCost: number
    op: string
    pc: number
    stack: string[]
    storage?: Record<string, string>
    refund?: number
}

interface OpcodeTracerResponse {
    failed: boolean
    gas: number
    returnValue: string
    structLogs: StructLog[]
}

const getVisitor = (): Visitor => {
    return (key, value) => {
        switch (key) {
            case 'gas':
            case 'gasCost':
            case 'ref_time':
            case 'proof_size': {
                return [key, `<${typeof value}>`]
            }
            case 'refund':
            case 'weightCost':
            case 'weightConsumed':
            case 'baseCallWeight': {
                return null
            }
            default: {
                return [key, value]
            }
        }
    }
}

const matchFixture = async (
    t: Deno.TestContext,
    res: OpcodeTracerResponse,
    path?: string,
) => {
    const visitor = getVisitor()
    const out = visit(res, visitor)

    if (Deno.env.get('DEBUG')) {
        const currentDir = new URL('.', import.meta.url).pathname
        const dir = `${currentDir}samples/opcode-tracer/`
        await Deno.mkdir(dir, { recursive: true })
        await Deno.writeTextFile(
            `${dir}${t.name}.${env.chain.name}.json`,
            JSON.stringify(res, null, 2),
        )
        await Deno.writeTextFile(
            `${dir}${t.name}.${env.chain.name}.mapped.json`,
            JSON.stringify(out, null, 2),
        )
    }

    await assertSnapshot(t, out, {
        name: t.name,
        path,
    })
}

Deno.test(
    'EVM opcode tracer: deploy flipper',
    { ...opts, ignore: !env.evm },
    async (t) => {
        const receipt = await getFlipperReceipt()
        const res = await env.debugClient.traceTransaction(
            receipt.transactionHash,
            'opcodeTracer',
            { disableStack: false, disableStorage: false },
        )
        await matchFixture(t, res as OpcodeTracerResponse)
    },
)

Deno.test(
    'EVM opcode tracer: flip',
    { ...opts, ignore: !env.evm },
    async (t) => {
        const to = await getFlipperContractAddr()
        const res = await env.debugClient.traceCall(
            {
                to,
                data: encodeFunctionData({
                    abi: FlipperAbi,
                    functionName: 'flip',
                }),
            },
            'opcodeTracer',
            { disableStack: false, disableStorage: false },
        )
        await matchFixture(t, res as OpcodeTracerResponse)
    },
)

Deno.test(
    'PVM syscall tracer: flip',
    { ...opts, ignore: env.evm },
    async (t) => {
        const { request } = await env.accountWallet.simulateContract({
            address: await getFlipperContractAddr(),
            abi: FlipperAbi,
            functionName: 'flip',
        })
        const hash = await env.accountWallet.writeContract(request)
        await env.accountWallet.waitForTransactionReceipt(hash)

        const res = await env.debugClient.traceTransaction(
            hash,
            'opcodeTracer',
            {},
        )

        await matchFixture(
            t,
            res as OpcodeTracerResponse,
            '__snapshots__/all-tests.pvm.ts.snap',
        )
    },
)
