import {
    getByteCode,
    createEnv,
    memoizedDeploy,
    visit,
    Visitor,
    computeMappingSlot,
} from './util.ts'
import { describe, expect, inject, test } from 'vitest'
import { encodeFunctionData, parseEther } from 'viem'
import { PretraceFixtureAbi } from '../abi/PretraceFixture.ts'
import { PretraceFixtureChildAbi } from '../abi/PretraceFixtureChild.ts'

const envs = await Promise.all(inject('envs').map(createEnv))

for (const env of envs) {
    const getAddr = memoizedDeploy(env, async () =>
        env.serverWallet.deployContract({
            abi: PretraceFixtureAbi,
            bytecode: getByteCode('PretraceFixture', env.evm),
            value: parseEther('10'),
        })
    )

    const getAddr2 = memoizedDeploy(env, async () =>
        env.serverWallet.deployContract({
            abi: PretraceFixtureChildAbi,
            bytecode: getByteCode('PretraceFixtureChild', env.evm),
        })
    )

    const getVisitor = async (): Promise<Visitor> => {
        let { miner: coinbaseAddr } = await env.publicClient.getBlock({
            blockTag: 'latest',
        })

        const walletbalanceStorageSlot = await computeMappingSlot(
            env.serverWallet.account.address,
            1
        )
        let mappedKeys = {
            [walletbalanceStorageSlot]: `<wallet_balance>`,
            [coinbaseAddr]: `<coinbase_addr>`,
            [await getAddr()]: `<contract_addr>`,
            [await getAddr2()]: `<contract_addr_2>`,
        }

        return (key, value) => {
            key = mappedKeys[key] ?? key
            switch (key) {
                case 'code': {
                    return [key, '<code>']
                }
                case 'nonce': {
                    return [key, '<nonce>']
                }
                case 'balance': {
                    return [key, '<balance>']
                }
                default: {
                    return [key, value]
                }
            }
        }
    }
    for (const config of [{ diffMode: true }, { diffMode: false }]) {
        const diffMode = config.diffMode ? 'diff' : 'no_diff'

        describe.skip(env.serverWallet.chain.name, () => {
            describe(diffMode, () => {
                const matchFixture = async (res: any, fixtureName: string) => {
                    const visitor = await getVisitor()
                    res = visit(res, visitor)
                    await expect(res).toMatchFileSnapshot(
                        `snapshots/prestate_tracer/${diffMode}/${fixtureName}.snap`
                    )
                }

                test('write_storage', async () => {
                    const res = await env.debugClient.traceCall(
                        {
                            to: await getAddr(),
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'writeStorage',
                                args: [2n],
                            }),
                        },
                        'prestateTracer',
                        config
                    )

                    await matchFixture(res, 'write_storage')
                })

                test('read_storage', async () => {
                    const res = await env.debugClient.traceCall(
                        {
                            to: await getAddr(),
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'readStorage',
                            }),
                        },
                        'prestateTracer',
                        config
                    )

                    await matchFixture(res, 'read_storage')
                })

                test('deposit', async () => {
                    const res = await env.debugClient.traceCall(
                        {
                            to: await getAddr(),
                            from: env.serverWallet.account.address,
                            value: parseEther('1'),
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'deposit',
                            }),
                        },
                        'prestateTracer',
                        config
                    )

                    await matchFixture(res, 'deposit')
                })

                test('withdraw', async () => {
                    const res = await env.debugClient.traceCall(
                        {
                            to: await getAddr(),
                            from: env.serverWallet.account.address,
                            value: parseEther('1'),
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'deposit',
                            }),
                        },
                        'prestateTracer',
                        config
                    )

                    await matchFixture(res, 'withdraw')
                })

                test('get_balance', async () => {
                    const res = await env.debugClient.traceCall(
                        {
                            to: await getAddr(),
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'getContractBalance',
                            }),
                        },
                        'prestateTracer',
                        config
                    )

                    await matchFixture(res, 'get_balance')
                })

                test('get_external_balance', async () => {
                    const addr = await getAddr2()
                    const res = await env.debugClient.traceCall(
                        {
                            to: await getAddr(),
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'getExternalBalance',
                                args: [addr],
                            }),
                        },
                        'prestateTracer',
                        config
                    )

                    await matchFixture(res, 'get_external_balance')
                })

                test('deploy_contract', async () => {
                    const res = await env.debugClient.traceCall(
                        {
                            to: await getAddr(),
                            from: env.serverWallet.account.address,
                            value: parseEther('1'),
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'createChild',
                            }),
                        },
                        'prestateTracer',
                        config
                    )

                    await matchFixture(res, 'deploy_contract')
                })

                test('call_contract', async () => {
                    const res = await env.debugClient.traceCall(
                        {
                            to: await getAddr(),
                            from: env.serverWallet.account.address,
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'callContract',
                                args: [await getAddr2()],
                            }),
                        },
                        'prestateTracer',
                        config
                    )

                    await matchFixture(res, 'call_contract')
                })

                test('delegate_call_contract', async () => {
                    const res = await env.debugClient.traceCall(
                        {
                            to: await getAddr(),
                            from: env.serverWallet.account.address,
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'callContract',
                                args: [await getAddr2()],
                            }),
                        },
                        'prestateTracer',
                        config
                    )

                    await matchFixture(res, 'delegate_call_contract')
                })
            })
        })
    }
}
