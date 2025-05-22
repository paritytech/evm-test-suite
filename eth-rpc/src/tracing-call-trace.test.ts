import {
    getByteCode,
    visit,
    createEnv,
    memoizedDeploy,
    Visitor,
    memoizedTx,
} from './util.ts'
import { describe, expect, inject, test } from 'vitest'
import { encodeFunctionData, parseEther } from 'viem'
import { TracingCallerAbi } from '../abi/TracingCaller.ts'
import { TracingCalleeAbi } from '../abi/TracingCallee.ts'

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

    const getReceipt = memoizedTx(env, async () => {
        const { request } = await env.serverWallet.simulateContract({
            address: await getTracingCallerAddr(),
            abi: TracingCallerAbi,
            functionName: 'start',
            args: [2n],
        })
        return await env.serverWallet.writeContract(request)
    })

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

    describe(env.serverWallet.chain.name, () => {
        const matchFixture = async (res: any, fixtureName: string) => {
            const visitor = await getVisitor()
            await expect(visit(res, visitor)).toMatchFileSnapshot(
                `snapshots/call_tracer/${fixtureName}.snap`
            )
        }

        test('debug_traceTransaction', async () => {
            const receipt = await getReceipt()
            const res = await env.debugClient.traceTransaction(
                receipt.transactionHash,
                'callTracer',
                {
                    withLog: true,
                }
            )
            await matchFixture(res, 'trace_transaction')
        })

        test('debug_traceBlock', async () => {
            const receipt = await getReceipt()
            const res = await env.debugClient.traceBlock(
                receipt.blockNumber,
                'callTracer',
                {
                    withLog: true,
                }
            )
            await matchFixture(res, 'trace_block')
        })

        test('debug_traceCall', async () => {
            const res = await env.debugClient.traceCall(
                {
                    to: await getTracingCallerAddr(),
                    data: encodeFunctionData({
                        abi: TracingCallerAbi,
                        functionName: 'start',
                        args: [2n],
                    }),
                },
                'callTracer',
                { withLog: true }
            )

            await matchFixture(res, 'debug_traceCall')
        })
    })
}
