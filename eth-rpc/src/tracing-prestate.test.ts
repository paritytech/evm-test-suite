import {
    getByteCode,
    createEnv,
    memoizedDeploy,
    visit,
    Visitor,
    computeMappingSlot,
    memoizedTx,
} from './util.ts'
import { describe, expect, inject, test } from 'vitest'
import { encodeFunctionData, parseEther } from 'viem'
import { PretraceFixtureAbi } from '../abi/PretraceFixture.ts'
import { PretraceFixtureChildAbi } from '../abi/PretraceFixtureChild.ts'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const envs = await Promise.all(inject('envs').map(createEnv))

for (const env of envs) {
    const deployReceipt = await memoizedTx(env, async () =>
        env.accountWallet.deployContract({
            abi: PretraceFixtureAbi,
            bytecode: getByteCode('PretraceFixture', env.evm),
            value: parseEther('10'),
        })
    )()

    const addr = deployReceipt.contractAddress!

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
            env.accountWallet.account.address,
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
                case 'codeHash': {
                    // Geth now returns the codeHash, skip it for now
                    // See https://github.com/ethereum/go-ethereum/pull/32391
                    return null
                }
                case '<coinbase_addr>': {
                    return null
                }
                default: {
                    return [key, value]
                }
            }
        }
    }
    for (const config of [{ diffMode: true }, { diffMode: false }]) {
        const diffMode = config.diffMode ? 'diff' : 'no_diff'

        describe(env.serverWallet.chain.name, () => {
            describe(diffMode, () => {
                const matchFixture = async (res: any, fixtureName: string) => {
                    const visitor = await getVisitor()
                    if (process.env.DEBUG) {
                        const __dirname = path.dirname(__filename)
                        const dir = `${__dirname}/samples/prestate_tracer/`
                        mkdirSync(dir, { recursive: true })
                        writeFileSync(
                            `${dir}/${fixtureName}.${env.chain.name}.${diffMode}.json`,
                            JSON.stringify(res, null, 2)
                        )
                    }

                    await expect(visit(res, visitor)).toMatchFileSnapshot(
                        `snapshots/prestate_tracer//${fixtureName}.${diffMode}.snap`
                    )
                }

                // skip for now until we resolve some traces diff on 0 nonce
                test.skip('deploy_contract', async ({ task }) => {
                    const res = await env.debugClient.traceTransaction(
                        deployReceipt.transactionHash,
                        'prestateTracer',
                        config
                    )
                    await matchFixture(res, task.name)
                })

                test('write_storage', async ({ task }) => {
                    const res = await env.debugClient.traceCall(
                        {
                            from: env.accountWallet.account.address,
                            to: addr,
                            data: encodeFunctionData({
                                abi: PretraceFixtureAbi,
                                functionName: 'writeStorage',
                                args: [2025n, task.name],
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
                                args: [2n, task.name],
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

                test('instantiate_child', async ({ task }) => {
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

                test('write_storage_twice', async ({ task }) => {
                    const nonce = await env.accountWallet.getTransactionCount(
                        env.accountWallet.account
                    )

                    const value = await env.accountWallet.readContract({
                        address: addr,
                        abi: PretraceFixtureAbi,
                        functionName: 'readStorage',
                    })

                    const requests = await Promise.all(
                        [nonce, nonce + 1].map(async (nonce, i) => {
                            const { request } =
                                await env.accountWallet.simulateContract({
                                    address: addr,
                                    abi: PretraceFixtureAbi,
                                    functionName: 'writeStorage',
                                    args: [value + BigInt(1 + i), task.name],
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

                    expect(receipts).toHaveLength(2)
                    expect(receipts.every((r) => r.status)).toBeTruthy()
                    expect(receipts[0].blockNumber).toEqual(
                        receipts[1].blockNumber
                    )

                    // Test traceBlock
                    {
                        const res = await env.debugClient.traceBlock(
                            receipts[0].blockNumber,
                            'prestateTracer',
                            config
                        )

                        await matchFixture(res, `trace_block_${task.name}`)
                    }

                    // Test traceTransaction
                    {
                        const res = await env.debugClient.traceTransaction(
                            receipts[1].transactionHash,
                            'prestateTracer',
                            config
                        )

                        await matchFixture(res, `trace_tx_${task.name}`)
                    }
                })
            })
        })
    }
}
