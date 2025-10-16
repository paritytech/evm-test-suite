import {
    computeMappingSlot,
    getByteCode,
    getEnv,
    sanitizeOpts as opts,
    visit,
    Visitor,
} from './util.ts'
import { assertSnapshot } from '@std/testing/snapshot'
import { expect } from '@std/expect'
import { encodeFunctionData, type Hex, parseEther } from 'viem'
import { PretraceFixtureAbi } from '../abi/PretraceFixture.ts'
import { PretraceFixtureChildAbi } from '../abi/PretraceFixtureChild.ts'

// Initialize test environment
const env = await getEnv()

let addr: Hex
let addr2: Hex
let receiptHash: Hex
let block: Awaited<ReturnType<typeof env.publicClient.getBlock>>

Deno.test.beforeAll(async () => {
    const hash1 = await env.accountWallet.deployContract({
        abi: PretraceFixtureAbi,
        bytecode: getByteCode('PretraceFixture', env.evm),
        value: parseEther('10'),
    })
    const receipt1 = await env.accountWallet.waitForTransactionReceipt(hash1)
    receiptHash = hash1
    addr = receipt1.contractAddress!

    const hash2 = await env.accountWallet.deployContract({
        abi: PretraceFixtureChildAbi,
        bytecode: getByteCode('PretraceFixtureChild', env.evm),
    })
    const receipt2 = await env.accountWallet.waitForTransactionReceipt(hash2)
    addr2 = receipt2.contractAddress!

    block = await env.publicClient.getBlock({
        blockTag: 'latest',
    })
})

const getVisitor = (): Visitor => {
    const { miner: coinbaseAddr } = block
    const walletbalanceStorageSlot = computeMappingSlot(
        env.accountWallet.account.address,
        1
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

const matchFixture = async (
    t: Deno.TestContext,
    res: unknown,
    fixtureName: string,
    diffMode: string
) => {
    const visitor = getVisitor()
    if (Deno.env.get('DEBUG')) {
        const currentDir = new URL('.', import.meta.url).pathname
        const dir = `${currentDir}samples/prestate_tracer/`
        await Deno.mkdir(dir, { recursive: true })
        await Deno.writeTextFile(
            `${dir}${fixtureName}.${env.chain.name}.${diffMode}.json`,
            JSON.stringify(res, null, 2)
        )
    }

    await assertSnapshot(t, visit(res, visitor), {
        name: `${fixtureName}.${diffMode}`,
    })
}

const withDiffModes = (
    testFn: (
        t: Deno.TestContext,
        config: { diffMode: boolean },
        diffMode: string
    ) => Promise<void>
) => {
    return async (t: Deno.TestContext) => {
        for (const config of [{ diffMode: true }, { diffMode: false }]) {
            const diffMode = config.diffMode ? 'diff' : 'no_diff'
            await t.step(diffMode, async () => {
                await testFn(t, config, diffMode)
            })
        }
    }
}

// skip for now until we resolve some traces diff on 0 nonce
Deno.test(
    'deploy_contract',
    { ignore: true, ...opts },
    withDiffModes(async (t, config, diffMode) => {
        const res = await env.debugClient.traceTransaction(
            receiptHash,
            'prestateTracer',
            config
        )
        await matchFixture(t, res, 'deploy_contract', diffMode)
    })
)

Deno.test(
    'write_storage',
    opts,
    withDiffModes(async (t, config, diffMode) => {
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
            block.hash!
        )

        await matchFixture(t, res, 'write_storage', diffMode)
    })
)

Deno.test(
    'write_storage_from_0',
    opts,
    withDiffModes(async (t, config, diffMode) => {
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
            block.hash!
        )

        await matchFixture(t, res, 'write_storage_from_0', diffMode)
    })
)

Deno.test(
    'read_storage',
    opts,
    withDiffModes(async (t, config, diffMode) => {
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
            block.hash!
        )

        await matchFixture(t, res, 'read_storage', diffMode)
    })
)

Deno.test(
    'deposit',
    opts,
    withDiffModes(async (t, config, diffMode) => {
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
            block.hash!
        )

        await matchFixture(t, res, 'deposit', diffMode)
    })
)

Deno.test(
    'withdraw',
    opts,
    withDiffModes(async (t, config, diffMode) => {
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
            block.hash!
        )

        await matchFixture(t, res, 'withdraw', diffMode)
    })
)

Deno.test(
    'get_balance',
    opts,
    withDiffModes(async (t, config, diffMode) => {
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
            block.hash!
        )

        await matchFixture(t, res, 'get_balance', diffMode)
    })
)

Deno.test(
    'get_external_balance',
    opts,
    withDiffModes(async (t, config, diffMode) => {
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
            block.hash!
        )

        await matchFixture(t, res, 'get_external_balance', diffMode)
    })
)

Deno.test(
    'instantiate_child',
    opts,
    withDiffModes(async (t, config, diffMode) => {
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
            block.hash!
        )

        await matchFixture(t, res, 'instantiate_child', diffMode)
    })
)

Deno.test(
    'call_contract',
    opts,
    withDiffModes(async (t, config, diffMode) => {
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

        await matchFixture(t, res, 'call_contract', diffMode)
    })
)

Deno.test(
    'delegate_call_contract',
    opts,
    withDiffModes(async (t, config, diffMode) => {
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
            block.hash!
        )

        await matchFixture(t, res, 'delegate_call_contract', diffMode)
    })
)

Deno.test(
    'write_storage_twice',
    opts,
    withDiffModes(async (t, config, diffMode) => {
        const nonce = await env.accountWallet.getTransactionCount(
            env.accountWallet.account
        )

        const value = await env.accountWallet.readContract({
            address: addr,
            abi: PretraceFixtureAbi,
            functionName: 'readStorage',
        })

        const hashes: Hex[] = []

        // start with the higher nonce so both can be sealed in the same block
        for (const [i, txNonce] of [nonce + 1, nonce].entries()) {
            const { request } = await env.accountWallet.simulateContract({
                address: addr,
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
            )
        )

        expect(receipts).toHaveLength(2)
        expect(receipts.every((r) => r.status)).toBeTruthy()
        expect(receipts[0].blockNumber).toEqual(receipts[1].blockNumber)

        // Test traceBlock
        {
            const res = await env.debugClient.traceBlock(
                receipts[0].blockNumber,
                'prestateTracer',
                config
            )

            await matchFixture(
                t,
                res,
                'trace_block_write_storage_twice',
                diffMode
            )
        }

        // Test traceTransaction
        {
            const res = await env.debugClient.traceTransaction(
                receipts[1].transactionHash,
                'prestateTracer',
                config
            )

            await matchFixture(t, res, 'trace_tx_write_storage_twice', diffMode)
        }
    })
)
