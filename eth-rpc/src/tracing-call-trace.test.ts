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
import path from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'

const envs = await Promise.all(inject('envs').map(createEnv))

for (const env of envs) {
    const TRACING_CALLEE_BYTECODE = getByteCode('TracingCallee', env.evm)
    const getDeployTracingCalleeReceipt = memoizedTx(env, async () =>
        env.accountWallet.deployContract({
            abi: TracingCalleeAbi,
            bytecode: TRACING_CALLEE_BYTECODE,
        })
    )

    const getTracingCalleeAddr = async () => {
        const receipt = await getDeployTracingCalleeReceipt()
        return receipt.contractAddress!
    }

    const getTracingCallerAddr = memoizedDeploy(env, async () =>
        env.accountWallet.deployContract({
            abi: TracingCallerAbi,
            args: [await getTracingCalleeAddr()],
            bytecode: getByteCode('TracingCaller', env.evm),
            value: parseEther('10'),
        })
    )

    const getStartReceipt = memoizedTx(env, async () => {
        const { request } = await env.accountWallet.simulateContract({
            address: await getTracingCallerAddr(),
            abi: TracingCallerAbi,
            functionName: 'start',
            args: [2n],
        })
        return await env.accountWallet.writeContract(request)
    })

    const getCreateReceipt = memoizedTx(env, async () => {
        const { request } = await env.accountWallet.simulateContract({
            address: await getTracingCallerAddr(),
            abi: TracingCallerAbi,
            functionName: 'create',
        })
        return await env.accountWallet.writeContract(request)
    })

    const getCreate2Receipt = memoizedTx(env, async () => {
        const { request } = await env.accountWallet.simulateContract({
            address: await getTracingCallerAddr(),
            abi: TracingCallerAbi,
            functionName: 'create2',
        })
        return await env.accountWallet.writeContract(request)
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
                        value == env.accountWallet.account.address.toLowerCase()
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

    describe(env.accountWallet.chain.name, () => {
        const matchFixture = async (res: any, fixtureName: string) => {
            const visitor = await getVisitor()

            if (process.env.DEBUG) {
                const __dirname = path.dirname(__filename)
                const dir = `${__dirname}/samples/call_tracer/`
                mkdirSync(dir, { recursive: true })
                writeFileSync(
                    `${dir}/${fixtureName}.${env.chain.name}.json`,
                    JSON.stringify(res, null, 2)
                )
            }

            await expect(visit(res, visitor)).toMatchFileSnapshot(
                `snapshots/call_tracer/${fixtureName}.snap`
            )
        }

        test('debug_traceTransaction', async ({ task }) => {
            const receipt = await getStartReceipt()
            const res = await env.debugClient.traceTransaction(
                receipt.transactionHash,
                'callTracer',
                {
                    withLog: true,
                }
            )
            await matchFixture(res, task.name)
        })

        test('debug_deploy_traceTransaction', async ({ task }) => {
            const receipt = await getDeployTracingCalleeReceipt()

            const res = await env.debugClient.traceTransaction(
                receipt.transactionHash,
                'callTracer',
                {
                    withLog: true,
                }
            )

            // We don't have runtime code output in revive
            delete res.output
            await matchFixture(res, task.name)
        })

        test('debug_create', async () => {
            const receipt = await getCreateReceipt()

            const res = await env.debugClient.traceTransaction(
                receipt.transactionHash,
                'callTracer',
                {
                    withLog: true,
                }
            )

            expect(res.calls[0].type).toEqual('CREATE')
            const code = await env.serverWallet.getCode({
                address: res.calls[0].to,
            })
            expect(code).toBeTruthy()
        })

        test('debug_create2', async () => {
            const receipt = await getCreate2Receipt()

            const res = await env.debugClient.traceTransaction(
                receipt.transactionHash,
                'callTracer',
                {
                    withLog: true,
                }
            )
            expect(res.calls[0].type).toEqual('CREATE2')
            const code = await env.serverWallet.getCode({
                address: res.calls[0].to,
            })
            expect(code).toBeTruthy()
        })

        test('debug_traceBlock', async ({ task }) => {
            const receipt = await getStartReceipt()
            const res = await env.debugClient.traceBlock(
                receipt.blockNumber,
                'callTracer',
                {
                    withLog: true,
                }
            )
            await matchFixture(res, task.name)
        })

        test('debug_traceCall', async ({ task }) => {
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

            await matchFixture(res, task.name)
        })
    })
}
