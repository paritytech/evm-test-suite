import {
    createEnv,
    getByteCode,
    memoizedDeploy,
    memoizedTx,
    visit,
    Visitor,
} from './util.ts'
import { assertSnapshot } from '@std/testing/snapshot'
import { expect } from '@std/expect'
import { describe, it } from '@std/testing/bdd'
import { getEnvs } from './test-setup.ts'
import { encodeFunctionData, parseEther } from 'viem'
import { TracingCallerAbi } from '../abi/TracingCaller.ts'
import { TracingCalleeAbi } from '../abi/TracingCallee.ts'

// Initialize test environments
const envs = await Promise.all(getEnvs().map(createEnv))

for (const env of envs) {
    const TRACING_CALLEE_BYTECODE = getByteCode('TracingCallee', env.evm)
    const getDeployTracingCalleeReceipt = memoizedTx(
        env,
        () =>
            env.accountWallet.deployContract({
                abi: TracingCalleeAbi,
                bytecode: TRACING_CALLEE_BYTECODE,
            }),
    )

    const getTracingCalleeAddr = async () => {
        const receipt = await getDeployTracingCalleeReceipt()
        return receipt.contractAddress!
    }

    const getTracingCallerAddr = memoizedDeploy(
        env,
        async () =>
            env.accountWallet.deployContract({
                abi: TracingCallerAbi,
                args: [await getTracingCalleeAddr()],
                bytecode: getByteCode('TracingCaller', env.evm),
                value: parseEther('10'),
            }),
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
                        typeof value === 'string' &&
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

    describe(env.accountWallet.chain.name, () => {
        it('debug_traceTransaction', async (t) => {
            const receipt = await getStartReceipt()
            const res = await env.debugClient.traceTransaction(
                receipt.transactionHash,
                'callTracer',
                {
                    withLog: true,
                },
            )
            await matchFixture(t, res, 'debug_traceTransaction')
        })

        it('debug_deploy_traceTransaction', async (t) => {
            const receipt = await getDeployTracingCalleeReceipt()

            const res = await env.debugClient.traceTransaction(
                receipt.transactionHash,
                'callTracer',
                {
                    withLog: true,
                },
            )

            // We don't have runtime code output in revive
            delete (res as Record<string, unknown>).output
            await matchFixture(t, res, 'debug_deploy_traceTransaction')
        })

        it('debug_create', async () => {
            const receipt = await getCreateReceipt()

            const res = await env.debugClient.traceTransaction(
                receipt.transactionHash,
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

        it('debug_create2', async () => {
            const receipt = await getCreate2Receipt()

            const res = await env.debugClient.traceTransaction(
                receipt.transactionHash,
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

        it('debug_traceBlock', async (t) => {
            const receipt = await getStartReceipt()
            const res = await env.debugClient.traceBlock(
                receipt.blockNumber,
                'callTracer',
                {
                    withLog: true,
                },
            )
            await matchFixture(t, res, 'debug_traceBlock')
        })

        it('debug_traceCall', async (t) => {
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
                { withLog: true },
            )

            await matchFixture(t, res, 'debug_traceCall')
        })
    })
}
