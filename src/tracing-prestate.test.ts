import {
    computeMappingSlot,
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
import { PretraceFixtureAbi } from '../abi/PretraceFixture.ts'
import { PretraceFixtureChildAbi } from '../abi/PretraceFixtureChild.ts'

// Initialize test environments
const envs = await Promise.all(getEnvs().map(createEnv))

for (const env of envs) {
    const deployReceipt = await memoizedTx(
        env,
        () =>
            env.accountWallet.deployContract({
                abi: PretraceFixtureAbi,
                bytecode: getByteCode('PretraceFixture', env.evm),
                value: parseEther('10'),
            }),
    )()

    const addr = deployReceipt.contractAddress!

    const addr2 = await memoizedDeploy(
        env,
        () =>
            env.accountWallet.deployContract({
                abi: PretraceFixtureChildAbi,
                bytecode: getByteCode('PretraceFixtureChild', env.evm),
            }),
    )()

    const block = await env.publicClient.getBlock({
        blockTag: 'latest',
    })

    const getVisitor = (): Visitor => {
        const { miner: coinbaseAddr } = block
        const walletbalanceStorageSlot = computeMappingSlot(
            env.accountWallet.account.address,
            1,
        )
        const mappedKeys = {
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
                case '<coinbase_addr>':
                case '0x0000000000000000000000000000000000000000': {
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

        describe(`${env.serverWallet.chain.name} - ${diffMode}`, () => {
            const matchFixture = async (
                t: Deno.TestContext,
                res: unknown,
                fixtureName: string,
            ) => {
                const visitor = getVisitor()
                if (Deno.env.get('DEBUG')) {
                    const currentDir = new URL('.', import.meta.url).pathname
                    const dir = `${currentDir}samples/prestate_tracer/`
                    await Deno.mkdir(dir, { recursive: true })
                    await Deno.writeTextFile(
                        `${dir}${fixtureName}.${env.chain.name}.${diffMode}.json`,
                        JSON.stringify(res, null, 2),
                    )
                }

                await assertSnapshot(t, visit(res, visitor), {
                    name: `${fixtureName}.${diffMode}`,
                })
            }

            // skip for now until we resolve some traces diff on 0 nonce
            // it('deploy_contract', async () => {
            //     const res = await env.debugClient.traceTransaction(
            //         deployReceipt.transactionHash,
            //         'prestateTracer',
            //         config
            //     )
            //     await matchFixture(res, 'deploy_contract')
            // }, { ignore: true })

            it('write_storage', async (t) => {
                const res = await env.debugClient.traceCall(
                    {
                        from: env.accountWallet.account.address,
                        to: addr,
                        data: encodeFunctionData({
                            abi: PretraceFixtureAbi,
                            functionName: 'writeStorage',
                            args: [2025n, 'write_storage'],
                        }),
                    },
                    'prestateTracer',
                    config,
                    block.hash,
                )

                await matchFixture(t, res, 'write_storage')
            })

            it('write_storage_from_0', async (t) => {
                const res = await env.debugClient.traceCall(
                    {
                        to: addr,
                        data: encodeFunctionData({
                            abi: PretraceFixtureAbi,
                            functionName: 'writeStorage',
                            args: [2n, 'write_storage_from_0'],
                        }),
                    },
                    'prestateTracer',
                    config,
                    block.hash,
                )

                await matchFixture(t, res, 'write_storage_from_0')
            })

            it('read_storage', async (t) => {
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
                    block.hash,
                )

                await matchFixture(t, res, 'read_storage')
            })

            it('deposit', async (t) => {
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
                    block.hash,
                )

                await matchFixture(t, res, 'deposit')
            })

            it('withdraw', async (t) => {
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
                    block.hash,
                )

                await matchFixture(t, res, 'withdraw')
            })

            it('get_balance', async (t) => {
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
                    block.hash,
                )

                await matchFixture(t, res, 'get_balance')
            })

            it('get_external_balance', async (t) => {
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
                    block.hash,
                )

                await matchFixture(t, res, 'get_external_balance')
            })

            it('instantiate_child', async (t) => {
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
                    block.hash,
                )

                await matchFixture(t, res, 'instantiate_child')
            })

            it('call_contract', async (t) => {
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
                )

                await matchFixture(t, res, 'call_contract')
            })

            it('delegate_call_contract', async (t) => {
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
                    block.hash,
                )

                await matchFixture(t, res, 'delegate_call_contract')
            })

            it('write_storage_twice', async (t) => {
                const nonce = await env.accountWallet.getTransactionCount(
                    env.accountWallet.account,
                )

                const value = await env.accountWallet.readContract({
                    address: addr,
                    abi: PretraceFixtureAbi,
                    functionName: 'readStorage',
                })

                // start with the higher nonce so both can be sealed in the same block
                const hashPromises = [nonce + 1, nonce].map(
                    async (nonce, i) => {
                        const { request } = await env.accountWallet
                            .simulateContract({
                                address: addr,
                                abi: PretraceFixtureAbi,
                                functionName: 'writeStorage',
                                args: [
                                    value + BigInt(1 + i),
                                    'write_storage_twice',
                                ],
                                nonce,
                            })

                        return env.accountWallet.writeContract(request)
                    },
                )

                const hashes = await Promise.all(hashPromises)

                const receipts = await Promise.all(
                    hashes.map((hash) =>
                        env.accountWallet.waitForTransactionReceipt(hash)
                    ),
                )

                expect(receipts).toHaveLength(2)
                expect(receipts.every((r) => r.status)).toBeTruthy()
                expect(receipts[0].blockNumber).toEqual(
                    receipts[1].blockNumber,
                )

                // Test traceBlock
                {
                    const res = await env.debugClient.traceBlock(
                        receipts[0].blockNumber,
                        'prestateTracer',
                        config,
                    )

                    await matchFixture(
                        t,
                        res,
                        `trace_block_write_storage_twice`,
                    )
                }

                // Test traceTransaction
                {
                    const res = await env.debugClient.traceTransaction(
                        receipts[1].transactionHash,
                        'prestateTracer',
                        config,
                    )

                    await matchFixture(t, res, `trace_tx_write_storage_twice`)
                }
            })
        })
    }
}
