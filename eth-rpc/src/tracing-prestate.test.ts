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
import { mkdirSync, writeFileSync } from 'node:fs'

const envs = await Promise.all(inject('envs').map(createEnv))

for (const env of envs) {
    const addr = await memoizedDeploy(env, async () => {
        return env.accountWallet.deployContract({
            abi: PretraceFixtureAbi,
            bytecode: getByteCode('PretraceFixture', env.evm),
            value: parseEther('10'),
        })
    })()

    const addr2 = await memoizedDeploy(env, async () =>
        env.accountWallet.deployContract({
            abi: PretraceFixtureChildAbi,
            bytecode: getByteCode('PretraceFixtureChild', env.evm),
        })
    )()

    const block = await env.publicClient.getBlock({
        blockTag: 'latest',
    })

    const getVisitor = async (): Promise<Visitor> => {
        let { miner: coinbaseAddr } = block
        const walletbalanceStorageSlot = await computeMappingSlot(
            env.serverWallet.account.address,
            1
        )
        let mappedKeys = {
            [walletbalanceStorageSlot]: `<wallet_balance>`,
            [coinbaseAddr.toLowerCase()]: `<coinbase_addr>`,
            [env.accountWallet.account.address.toLowerCase()]: `<caller_addr>`,
            [addr.toLowerCase()]: `<contract_addr>`,
            [addr2.toLowerCase()]: `<contract_addr_2>`,
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
                case 'txHash': {
                    return [key, '<tx_hash>']
                }
                default: {
                    return [key, value]
                }
            }
        }
    }
    for (const config of [
        { diffMode: true, disableCode: true },
        { diffMode: false, disableCode: true },
    ]) {
        const diffMode = config.diffMode ? 'diff' : 'no_diff'

        describe(env.serverWallet.chain.name, () => {
            describe(diffMode, () => {
                const matchFixture = async (res: any, fixtureName: string) => {
                    const visitor = await getVisitor()
                    const dir = `/home/pg/github/evm-test-suite/eth-rpc/src/samples/${env.chain.name}/prestate_tracer/${diffMode}/`
                    mkdirSync(dir, { recursive: true })

                    writeFileSync(
                        `${dir}/${fixtureName}.json`,
                        JSON.stringify(res, null, 2)
                    )

                    const sortedRes = Object.fromEntries(
                        Object.entries(res).sort(([k1], [k2]) => {
                            return k2.localeCompare(k1)
                        })
                    )
                    await expect(visit(sortedRes, visitor)).toMatchFileSnapshot(
                        `snapshots/prestate_tracer/${diffMode}/${fixtureName}.snap`
                    )
                }

                test('write_storage', async ({ task }) => {
                    const res = await env.debugClient.traceCall(
                        {
                            from: env.accountWallet.account.address,
                            to: addr,
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'writeStorage',
                                args: [2n],
                            }),
                        },
                        'prestateTracer',
                        config,
                        block.hash
                    )

                    await matchFixture(res, task.name)
                })

                test('write_storage_from_0', async ({ task }) => {
                    const res = await env.debugClient.traceCall(
                        {
                            to: addr,
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'writeStorage',
                                args: [2n],
                            }),
                        },
                        'prestateTracer',
                        config,
                        block.hash
                    )

                    await matchFixture(res, task.name)
                })

                test('read_storage', async ({ task }) => {
                    const res = await env.debugClient.traceCall(
                        {
                            from: env.accountWallet.account.address,
                            to: addr,
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'readStorage',
                            }),
                        },
                        'prestateTracer',
                        config,
                        block.hash
                    )

                    await matchFixture(res, task.name)
                })

                test('deposit', async ({ task }) => {
                    const res = await env.debugClient.traceCall(
                        {
                            from: env.accountWallet.account.address,
                            to: addr,
                            value: parseEther('1'),
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'deposit',
                            }),
                        },
                        'prestateTracer',
                        config,
                        block.hash
                    )

                    await matchFixture(res, task.name)
                })

                test('withdraw', async ({ task }) => {
                    const res = await env.debugClient.traceCall(
                        {
                            from: env.accountWallet.account.address,
                            to: addr,
                            value: parseEther('1'),
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'deposit',
                            }),
                        },
                        'prestateTracer',
                        config,
                        block.hash
                    )

                    await matchFixture(res, task.name)
                })

                test('get_balance', async ({ task }) => {
                    const res = await env.debugClient.traceCall(
                        {
                            from: env.accountWallet.account.address,
                            to: addr,
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'getContractBalance',
                            }),
                        },
                        'prestateTracer',
                        config,
                        block.hash
                    )

                    await matchFixture(res, task.name)
                })

                test('get_external_balance', async ({ task }) => {
                    const res = await env.debugClient.traceCall(
                        {
                            from: env.accountWallet.account.address,
                            to: addr,
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'getExternalBalance',
                                args: [addr2],
                            }),
                        },
                        'prestateTracer',
                        config,
                        block.hash
                    )

                    await matchFixture(res, task.name)
                })

                test('deploy_contract', async ({ task }) => {
                    const res = await env.debugClient.traceCall(
                        {
                            from: env.accountWallet.account.address,
                            to: addr,
                            value: parseEther('1'),
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'createChild',
                            }),
                        },
                        'prestateTracer',
                        config,
                        block.hash
                    )

                    await matchFixture(res, task.name)
                })

                test('call_contract', async ({ task }) => {
                    const res = await env.debugClient.traceCall(
                        {
                            from: env.accountWallet.account.address,
                            to: addr,
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'callContract',
                                args: [addr2],
                            }),
                        },
                        'prestateTracer',
                        config
                    )

                    await matchFixture(res, task.name)
                })

                test('delegate_call_contract', async ({ task }) => {
                    const res = await env.debugClient.traceCall(
                        {
                            from: env.accountWallet.account.address,
                            to: addr,
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'callContract',
                                args: [addr2],
                            }),
                        },
                        'prestateTracer',
                        config,
                        block.hash
                    )

                    await matchFixture(res, task.name)
                })

                test('write_storage twice', async ({ task }) => {
                    const nonce = await env.accountWallet.getTransactionCount(
                        env.accountWallet.account
                    )

                    const requests = await Promise.all(
                        [nonce, nonce + 1].map(async (nonce, i) => {
                            const { request } =
                                await env.accountWallet.simulateContract({
                                    address: addr,
                                    abi: PretraceFixtureAbi,
                                    functionName: 'writeStorage',
                                    args: [BigInt(i + 42)],
                                    nonce,
                                })
                            return request
                        })
                    )

                    const hashes = await Promise.all(
                        requests.map((request) =>
                            env.accountWallet.writeContract(request)
                        )
                    )

                    const receipts = await Promise.all(
                        hashes.map((hash) =>
                            env.accountWallet.waitForTransactionReceipt({
                                hash,
                            })
                        )
                    )

                    const status = receipts.every((r) => r.status)
                    expect(status).toBeTruthy()

                    const res = await env.debugClient.traceBlock(
                        receipts[0].blockNumber,
                        'prestateTracer',
                        config
                    )

                    await matchFixture(res, task.name)
                })
            })
        })
    }
}
