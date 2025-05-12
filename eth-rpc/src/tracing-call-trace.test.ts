import {
    jsonRpcErrors,
    getByteCode,
    visit,
    createEnv,
    memoizedDeploy,
    fixture,
    writeFixture,
    Visitor,
} from './util.ts'
import { afterEach, expect, inject, test } from 'vitest'

import { encodeFunctionData, parseEther } from 'viem'
import { TracingCallerAbi } from '../abi/TracingCaller.ts'
import { TracingCalleeAbi } from '../abi/TracingCallee.ts'

afterEach(() => {
    jsonRpcErrors.length = 0
})

const envs = await Promise.all(inject('envs').map(createEnv))
for (const env of envs) {
    const getTracingCalleeAddr = memoizedDeploy(env, async () =>
        env.serverWallet.deployContract({
            abi: TracingCalleeAbi,
            bytecode: getByteCode('TracingCallee', env.evm),
        })
    )

    const getTracingCallerAddr = memoizedDeploy(env, async () =>
        env.serverWallet.deployContract({
            abi: TracingCallerAbi,
            args: [await getTracingCalleeAddr()],
            bytecode: getByteCode('TracingCaller', env.evm),
            value: parseEther('10'),
        })
    )

    const getVisitor = async (): Promise<Visitor> => {
        const callerAddr = await getTracingCallerAddr()
        const calleeAddr = await getTracingCalleeAddr()
        return (key, value) => {
            switch (key) {
                case 'address':
                case 'from':
                case 'to': {
                    if (value === callerAddr) {
                        return [key, '<contract_addr>']
                    } else if (value === calleeAddr) {
                        return [key, '<contract_callee_addr>']
                    } else if (
                        value == env.serverWallet.account.address.toLowerCase()
                    ) {
                        return [key, '<caller>']
                    }

                    return [key, value]
                }
                case 'revertReason':
                    return [
                        key,
                        value.startsWith('revert: ')
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
                default: {
                    return [key, value]
                }
            }
        }
    }

    test('call_tracing', async () => {
        const callerAddr = await getTracingCallerAddr()

        const matchFixture = async (res: any, fixtureName: string) => {
            const visitor = await getVisitor()
            res = visit(res, visitor)
            await expect(res).toMatchFileSnapshot(
                `snapshots/call_tracer_${fixtureName}.snap`
            )
        }

        const receipt = await (async () => {
            const { request } = await env.serverWallet.simulateContract({
                address: callerAddr,
                abi: TracingCallerAbi,
                functionName: 'start',
                args: [2n],
            })
            const hash = await env.serverWallet.writeContract(request)
            return await env.serverWallet.waitForTransactionReceipt({
                hash,
            })
        })()

        // test debug_traceTransaction
        {
            const res = await env.debugClient.traceTransaction(
                receipt.transactionHash,
                'callTracer',
                {
                    withLog: true,
                }
            )
            matchFixture(res, 'trace_transaction')
        }

        // test debug_traceBlock
        {
            const res = await env.debugClient.traceBlock(
                receipt.blockNumber,
                'callTracer',
                {
                    withLog: true,
                }
            )
            matchFixture(res, 'trace_block')
        }

        // test debug_traceCall
        {
            const res = await env.debugClient.traceCall(
                {
                    to: callerAddr,
                    data: encodeFunctionData({
                        abi: TracingCallerAbi,
                        functionName: 'start',
                        args: [2n],
                    }),
                },
                'callTracer',
                { withLog: true }
            )

            matchFixture(res, 'debug_traceCall')
        }
    })
}
