import { type Hex, hexToBigInt, hexToNumber } from 'viem'
import { getReadOnlyEnv, sanitizeOpts as opts } from './util.ts'
import { expect } from '@std/expect'

// Lightweight read-only environment — no wallets, no funding, no deployments.
const env = await getReadOnlyEnv()

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as const
const REVIVE_DEPLOY_BLOCK = 13169391n

const untypedRequest = (method: string, params?: unknown[]) =>
    // deno-lint-ignore no-explicit-any
    env.publicClient.request({ method, params } as any)

Deno.test('westend: eth_accounts', opts, async () => {
    const addresses = await untypedRequest('eth_accounts')
    expect(Array.isArray(addresses)).toBe(true)
})

Deno.test('westend: eth_blockNumber', opts, async () => {
    const res = await env.publicClient.request({
        method: 'eth_blockNumber',
    })
    expect(typeof hexToBigInt(res)).toEqual('bigint')
})

Deno.test('westend: eth_chainId', opts, async () => {
    const res = await env.publicClient.request({
        method: 'eth_chainId',
    })
    expect(hexToNumber(res)).toEqual(env.chain.id)
})

Deno.test('westend: eth_gasPrice', opts, async () => {
    const res = await env.publicClient.request({
        method: 'eth_gasPrice',
    })
    expect(hexToBigInt(res) > 0n).toBe(true)
})

Deno.test('westend: eth_getBalance', opts, async () => {
    const balance = await env.publicClient.getBalance({
        address: ZERO_ADDR,
    })
    expect(typeof balance).toEqual('bigint')
})

Deno.test('westend: eth_getBlockByNumber (latest)', opts, async () => {
    const block = await env.publicClient.getBlock({ blockTag: 'latest' })
    expect(block).toBeTruthy()
    expect(block.number).toBeTruthy()
    expect(block.hash).toBeTruthy()
    expect(block.timestamp).toBeTruthy()
})

Deno.test(
    'westend: eth_getBlockByNumber (known block)',
    opts,
    async () => {
        const block = await env.publicClient.getBlock({
            blockNumber: REVIVE_DEPLOY_BLOCK,
        })
        expect(block).toBeTruthy()
        expect(block.number).toEqual(REVIVE_DEPLOY_BLOCK)
    },
)

Deno.test('westend: eth_getBlockByHash', opts, async () => {
    const latest = await env.publicClient.getBlock({ blockTag: 'latest' })
    const byHash = await env.publicClient.getBlock({
        blockHash: latest.hash!,
    })
    expect(byHash.number).toEqual(latest.number)
})

Deno.test(
    'westend: eth_getBlockTransactionCount',
    opts,
    async () => {
        const count = await env.publicClient.getBlockTransactionCount({
            blockTag: 'latest',
        })
        expect(typeof count).toEqual('number')
    },
)

Deno.test('westend: eth_getTransactionCount', opts, async () => {
    const count = await env.publicClient.getTransactionCount({
        address: ZERO_ADDR,
    })
    expect(typeof count).toEqual('number')
})

Deno.test('westend: eth_getCode', opts, async () => {
    const code = await env.publicClient.getCode({
        address: ZERO_ADDR,
    })
    // Zero address is an EOA — expect no code
    expect(code === undefined || code === '0x').toBe(true)
})

// On a live network, querying storage at a non-contract address returns
// an RPC error ("Contract not found") rather than a zero value.
// We verify the runtime API is reachable by accepting either outcome.
Deno.test('westend: eth_getStorageAt', opts, async () => {
    try {
        const storage = await env.publicClient.getStorageAt({
            address: ZERO_ADDR,
            slot:
                '0x0000000000000000000000000000000000000000000000000000000000000000',
        })
        expect(typeof storage).toEqual('string')
    } catch (err) {
        // "Contract not found" is an expected response for non-contract addresses
        expect(String(err)).toContain('Contract not found')
    }
})

Deno.test('westend: eth_syncing', opts, async () => {
    const res = await untypedRequest('eth_syncing')
    expect(res).toEqual(false)
})

Deno.test('westend: eth_feeHistory', opts, async () => {
    const feeHistory = await env.publicClient.getFeeHistory({
        blockCount: 4,
        blockTag: 'latest',
        rewardPercentiles: [25, 75],
    })
    expect(feeHistory.oldestBlock).toBeGreaterThanOrEqual(0)
    expect(feeHistory.gasUsedRatio.length).toBeGreaterThanOrEqual(0)
    expect(feeHistory.baseFeePerGas).toBeTruthy()
})

Deno.test('westend: eth_maxPriorityFeePerGas', opts, async () => {
    const res = await untypedRequest('eth_maxPriorityFeePerGas') as Hex
    expect(typeof hexToBigInt(res)).toEqual('bigint')
})

Deno.test('westend: net_version', opts, async () => {
    const res = await untypedRequest('net_version')
    expect(res).toBeTruthy()
})

Deno.test('westend: web3_clientVersion', opts, async () => {
    const res = await untypedRequest('web3_clientVersion')
    expect(res).toBeTruthy()
})

// eth_estimateGas calls the eth_estimate_gas runtime API.
// Without .unvalidated() (polkadot-sdk#11468), this fails with metadata mismatch
// when eth-rpc is compiled against a newer runtime than the live chain.
Deno.test('westend: eth_estimateGas', opts, async () => {
    const gas = await env.publicClient.estimateGas({
        account: ZERO_ADDR,
        to: '0x0000000000000000000000000000000000000001',
    })
    expect(gas > 0n).toBe(true)
})

Deno.test('westend: eth_call', opts, async () => {
    const result = await env.publicClient.call({
        to: '0x0000000000000000000000000000000000000001',
    })
    // Just verify it returns without RPC error
    expect(typeof result).toEqual('object')
})
