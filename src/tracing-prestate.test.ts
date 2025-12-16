import {
    computeMappingSlot,
    memoized,
    sanitizeOpts as opts,
    visit,
    Visitor,
} from './util.ts'
import { assertSnapshot } from '@std/testing/snapshot'
import { expect } from '@std/expect'
import { encodeFunctionData, type Hex, parseEther } from 'viem'
import { PretraceFixtureAbi } from '../codegen/abi/PretraceFixture.ts'
import {
    env,
    getPretraceFixtureAddr,
    getPretraceFixtureChildAddr,
    getPretraceFixtureReceipt,
    getTracingCallerAddr,
} from './deploy_contracts.ts'
import { TracingCallerAbi } from '../codegen/abi/TracingCaller.ts'

const getBlock = memoized(async () => {
    const receipt = await getPretraceFixtureReceipt()
    return await env.publicClient.getBlock({
        blockHash: receipt.blockHash!,
    })
})

const getVisitor = async (): Promise<Visitor> => {
    const prestateAddr = await getPretraceFixtureAddr()
    const prestateChildAddr = await getPretraceFixtureChildAddr()
    const tracingCallerAddr = await getTracingCallerAddr()
    const { miner: coinbaseAddr } = await getBlock()
    const walletbalanceStorageSlot = computeMappingSlot(
        env.accountWallet.account.address,
        1,
    )
    const mappedKeys = {
        [walletbalanceStorageSlot]: `<wallet_balance>`,
        [coinbaseAddr.toLowerCase()]: `<coinbase_addr>`,
        [env.accountWallet.account.address.toLowerCase()]: `<caller_addr>`,
        [prestateAddr.toLowerCase()]: `<prestate_contract_addr>`,
        [prestateChildAddr.toLowerCase()]: `<prestate_contract_child_addr>`,
        [tracingCallerAddr.toLowerCase()]: `<tracing_contract_addr>`,
    }

    return (key, value) => {
        key = mappedKeys[key] ?? key
        switch (key) {
            case 'code': {
                return [key, `<${typeof value}>`]
            }
            case 'nonce': {
                return [key, `<${typeof value}>`]
            }
            case 'balance': {
                return [key, `<${typeof value}>`]
            }
            case 'txHash': {
                return [key, `<${typeof value}>`]
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

const matchFixture = async (
    t: Deno.TestContext,
    res: unknown,
    diffMode: string,
) => {
    const visitor = await getVisitor()
    const out = visit(res, visitor)
    if (Deno.env.get('DEBUG')) {
        const currentDir = new URL('.', import.meta.url).pathname
        const dir = `${currentDir}samples/prestate_tracer/`
        await Deno.mkdir(dir, { recursive: true })
        await Deno.writeTextFile(
            `${dir}${t.name}.${env.chain.name}.${diffMode}.json`,
            JSON.stringify(res, null, 2),
        )
        await Deno.writeTextFile(
            `${dir}${t.name}.${env.chain.name}.${diffMode}.mapped.json`,
            JSON.stringify(out, null, 2),
        )
    }

    await assertSnapshot(t, out, {
        name: `${t.name}.${diffMode}`,
    })
}

const withDiffModes = (
    testFn: (
        t: Deno.TestContext,
        config: { diffMode: boolean },
        diffMode: string,
    ) => Promise<void>,
    configs = [{ diffMode: true }, { diffMode: false }],
) => {
    return async (t: Deno.TestContext) => {
        for (const config of configs) {
            const diffMode = config.diffMode ? 'diff' : 'no_diff'
            await t.step(diffMode, async () => {
                await testFn(t, config, diffMode)
            })
        }
    }
}

Deno.test(
    'prestate deploy_contract',
    opts,
    withDiffModes(async (t, config, diffMode) => {
        const receipt = await getPretraceFixtureReceipt()
        const res = await env.debugClient.traceTransaction(
            receipt.transactionHash,
            'prestateTracer',
            config,
        )
        await matchFixture(t, res, diffMode)
    }),
)

Deno.test(
    'prestate write_storage',
    opts,
    withDiffModes(async (t, config, diffMode) => {
        const res = await env.debugClient.traceCall(
            {
                from: env.accountWallet.account.address,
                to: await getPretraceFixtureAddr(),
                data: encodeFunctionData({
                    abi: PretraceFixtureAbi,
                    functionName: 'writeStorage',
                    args: [2025n, 'write_storage'],
                }),
            },
            'prestateTracer',
            config,
        )

        await matchFixture(t, res, diffMode)
    }),
)

Deno.test(
    'prestate write_storage_from_0',
    opts,
    withDiffModes(async (t, config, diffMode) => {
        const res = await env.debugClient.traceCall(
            {
                to: await getPretraceFixtureAddr(),
                data: encodeFunctionData({
                    abi: PretraceFixtureAbi,
                    functionName: 'writeStorage',
                    args: [2n, 'write_storage_from_0'],
                }),
            },
            'prestateTracer',
            config,
        )

        await matchFixture(t, res, diffMode)
    }),
)

Deno.test(
    'prestate read_storage',
    opts,
    withDiffModes(async (t, config, diffMode) => {
        const res = await env.debugClient.traceCall(
            {
                from: env.accountWallet.account.address,
                to: await getPretraceFixtureAddr(),
                data: encodeFunctionData({
                    abi: PretraceFixtureAbi,
                    functionName: 'readStorage',
                }),
            },
            'prestateTracer',
            config,
        )

        await matchFixture(t, res, diffMode)
    }),
)

Deno.test(
    'prestate deposit',
    opts,
    withDiffModes(async (t, config, diffMode) => {
        const res = await env.debugClient.traceCall(
            {
                from: env.accountWallet.account.address,
                to: await getPretraceFixtureAddr(),
                value: parseEther('1'),
                data: encodeFunctionData({
                    abi: PretraceFixtureAbi,
                    functionName: 'deposit',
                }),
            },
            'prestateTracer',
            config,
        )

        await matchFixture(t, res, diffMode)
    }),
)

Deno.test(
    'prestate withdraw',
    opts,
    withDiffModes(async (t, config, diffMode) => {
        const res = await env.debugClient.traceCall(
            {
                from: env.accountWallet.account.address,
                to: await getPretraceFixtureAddr(),
                value: parseEther('1'),
                data: encodeFunctionData({
                    abi: PretraceFixtureAbi,
                    functionName: 'deposit',
                }),
            },
            'prestateTracer',
            config,
        )

        await matchFixture(t, res, diffMode)
    }),
)

Deno.test(
    'prestate get_balance',
    opts,
    withDiffModes(async (t, config, diffMode) => {
        const res = await env.debugClient.traceCall(
            {
                from: env.accountWallet.account.address,
                to: await getPretraceFixtureAddr(),
                data: encodeFunctionData({
                    abi: PretraceFixtureAbi,
                    functionName: 'getContractBalance',
                }),
            },
            'prestateTracer',
            config,
        )

        await matchFixture(t, res, diffMode)
    }),
)

Deno.test(
    'prestate get_external_balance',
    opts,
    withDiffModes(async (t, config, diffMode) => {
        const res = (await env.debugClient.traceCall(
            {
                from: env.accountWallet.account.address,
                to: await getPretraceFixtureAddr(),
                data: encodeFunctionData({
                    abi: PretraceFixtureAbi,
                    functionName: 'getExternalBalance',
                    args: [await getPretraceFixtureChildAddr()],
                }),
            },
            'prestateTracer',
            config,
        )) as Record<string, unknown>

        await matchFixture(t, res, diffMode)
    }),
)

Deno.test(
    'prestate instantiate_child',
    opts,
    withDiffModes(async (t, config, diffMode) => {
        const res = await env.debugClient.traceCall(
            {
                from: env.accountWallet.account.address,
                to: await getPretraceFixtureAddr(),
                value: parseEther('1'),
                data: encodeFunctionData({
                    abi: PretraceFixtureAbi,
                    functionName: 'createChild',
                }),
            },
            'prestateTracer',
            config,
        )

        await matchFixture(t, res, diffMode)
    }),
)

Deno.test(
    'prestate call_contract',
    opts,
    withDiffModes(async (t, config, diffMode) => {
        const res = await env.debugClient.traceCall(
            {
                from: env.accountWallet.account.address,
                to: await getPretraceFixtureAddr(),
                data: encodeFunctionData({
                    abi: PretraceFixtureAbi,
                    functionName: 'callContract',
                    args: [await getPretraceFixtureChildAddr()],
                }),
            },
            'prestateTracer',
            config,
        )

        await matchFixture(t, res, diffMode)
    }),
)

Deno.test(
    'prestate delegate_call_contract',
    opts,
    withDiffModes(async (t, config, diffMode) => {
        const to = await getPretraceFixtureAddr()
        const childAddr = await getPretraceFixtureChildAddr()

        const res = await env.debugClient.traceCall(
            {
                from: env.accountWallet.account.address,
                to,
                data: encodeFunctionData({
                    abi: PretraceFixtureAbi,
                    functionName: 'delegatecallContract',
                    args: [childAddr],
                }),
            },
            'prestateTracer',
            config,
        )

        await matchFixture(t, res, diffMode)
    }),
)

Deno.test(
    'prestate write_storage_twice',
    opts,
    withDiffModes(async (t, config, diffMode) => {
        const value = await env.accountWallet.readContract({
            address: await getPretraceFixtureAddr(),
            abi: PretraceFixtureAbi,
            functionName: 'readStorage',
        })

        const hashes: Hex[] = []

        const nonce = await env.accountWallet.getTransactionCount(
            env.accountWallet.account,
        )

        // start with the higher nonce so both can be sealed in the same block
        for (const [i, txNonce] of [nonce + 1, nonce].entries()) {
            const { request } = await env.accountWallet.simulateContract({
                address: await getPretraceFixtureAddr(),
                abi: PretraceFixtureAbi,
                functionName: 'writeStorage',
                args: [value + BigInt(i + 1), 'write_storage_twice'],
                nonce: txNonce,
            })
            const hash = await env.accountWallet.writeContract(request)
            hashes.push(hash)
        }

        const receipts = await Promise.all(
            hashes.map((hash) =>
                env.accountWallet.waitForTransactionReceipt(hash)
            ),
        )

        expect(receipts).toHaveLength(2)
        expect(receipts.every((r) => r.status)).toBeTruthy()
        expect(receipts[0].blockNumber).toEqual(receipts[1].blockNumber)

        await t.step('prestate trace_block_write_storage_twice', async (t) => {
            const res = await env.debugClient.traceBlock(
                receipts[0].blockNumber,
                'prestateTracer',
                config,
            )

            await matchFixture(t, res, diffMode)
        })

        // Test traceTransaction
        await t.step('prestate trace_tx_write_storage_twice', async (t) => {
            const res = await env.debugClient.traceTransaction(
                receipts[1].transactionHash,
                'prestateTracer',
                config,
            )

            await matchFixture(t, res, diffMode)
        })
    }),
)

Deno.test(
    'prestate selfdestruct',
    opts,
    withDiffModes(async (t, config, diffMode) => {
        const tracingCallerAddr = await getTracingCallerAddr()
        const res = await env.debugClient.traceCall(
            {
                to: tracingCallerAddr,
                data: encodeFunctionData({
                    abi: TracingCallerAbi,
                    functionName: 'destruct',
                    args: [],
                }),
            },
            'prestateTracer',
            config,
        )
        await matchFixture(t, res, diffMode)
    }),
)

Deno.test(
    'prestate create_and_destruct',
    opts,
    withDiffModes(
        async (t, config, diffMode) => {
            const tracingCallerAddr = await getTracingCallerAddr()
            const res = await env.debugClient.traceCall(
                {
                    to: tracingCallerAddr,
                    data: encodeFunctionData({
                        abi: TracingCallerAbi,
                        functionName: 'create_and_destruct',
                        args: [],
                    }),
                },
                'prestateTracer',
                config,
            )
            await matchFixture(t, res, diffMode)
        },
    ),
)
