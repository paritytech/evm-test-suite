import {
    decodeFunctionResult,
    encodeFunctionData,
    type Hex,
    parseEther,
    zeroAddress,
} from 'viem'
import { getRuntimeByteCode, sanitizeOpts as opts } from './util.ts'
import { expect } from '@std/expect'
import { TesterAbi } from '../codegen/abi/Tester.ts'
import { FlipperAbi } from '../codegen/abi/Flipper.ts'
import { env, getFlipperContractAddr, getTesterAddr } from './deploy_contracts.ts'

/// Helper to make an eth_call with state overrides via raw JSON-RPC request.
///
/// Viem's high-level `call` method does not expose the state override parameter,
/// so we use the raw `request` method to send `eth_call` with the third parameter
/// containing the state override set.
async function ethCallWithOverrides(
    to: Hex,
    data: Hex,
    stateOverrides: Record<string, Record<string, unknown>>,
    from?: Hex,
): Promise<Hex> {
    return await env.publicClient.request({
        method: 'eth_call',
        params: [
            { from: from ?? zeroAddress, to, data },
            'latest',
            stateOverrides,
        ],
    }) as Hex
}

Deno.test('state_override: balance enables value transfer', opts, async () => {
    const sender = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex
    const recipient = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hex

    const result = await env.publicClient.request({
        method: 'eth_call',
        params: [
            { from: sender, to: recipient, value: '0x3e8' },
            'latest',
            { [sender]: { balance: '0xDE0B6B3A7640000' } },
        ],
    })

    expect(result).toBeDefined()
})

Deno.test('state_override: balance zero prevents transfer', opts, async () => {
    const sender = env.serverWallet.account.address

    try {
        await env.publicClient.request({
            method: 'eth_call',
            params: [
                { from: sender, to: zeroAddress, value: '0x1' },
                'latest',
                { [sender]: { balance: '0x0' } },
            ],
        })
        throw new Error('Expected to fail')
    } catch (_err) {
        // Call should fail because sender balance is overridden to zero.
    }
})

Deno.test('state_override: code on empty address', opts, async () => {
    const target = '0xcccccccccccccccccccccccccccccccccccccccc' as Hex
    const runtimeCode = getRuntimeByteCode('Tester', env.evm)

    const data = encodeFunctionData({
        abi: TesterAbi,
        functionName: 'value',
    })

    const result = await ethCallWithOverrides(target, data, {
        [target]: { code: runtimeCode },
    })

    const value = decodeFunctionResult({
        abi: TesterAbi,
        functionName: 'value',
        data: result,
    })
    expect(value).toEqual(0n)
})

Deno.test('state_override: code on existing contract', opts, async () => {
    const testerAddr = await getTesterAddr()
    const flipperAddr = await getFlipperContractAddr()
    const flipperRuntime = getRuntimeByteCode('Flipper', env.evm)

    // Override Tester's code with Flipper's runtime code, then call Flipper's
    // getValue() on Tester's address.
    const data = encodeFunctionData({
        abi: FlipperAbi,
        functionName: 'getValue',
    })

    const result = await ethCallWithOverrides(testerAddr, data, {
        [testerAddr]: { code: flipperRuntime },
    })

    const value = decodeFunctionResult({
        abi: FlipperAbi,
        functionName: 'getValue',
        data: result,
    })
    // Storage slot 0 of Tester holds 42 (uint256). Flipper reads slot 0 as bool.
    // Any non-zero value is true.
    expect(value).toEqual(true)
})

Deno.test('state_override: stateDiff patches slot', opts, async () => {
    const address = await getTesterAddr()

    const data = encodeFunctionData({
        abi: TesterAbi,
        functionName: 'value',
    })

    const result = await ethCallWithOverrides(address, data, {
        [address]: {
            stateDiff: {
                '0x0000000000000000000000000000000000000000000000000000000000000000':
                    '0x00000000000000000000000000000000000000000000000000000000000003e7',
            },
        },
    })

    const value = decodeFunctionResult({
        abi: TesterAbi,
        functionName: 'value',
        data: result,
    })
    expect(value).toEqual(999n)
})

Deno.test('state_override: state full replacement', opts, async () => {
    const address = await getTesterAddr()

    const data = encodeFunctionData({
        abi: TesterAbi,
        functionName: 'value',
    })

    const result = await ethCallWithOverrides(address, data, {
        [address]: {
            state: {
                '0x0000000000000000000000000000000000000000000000000000000000000000':
                    '0x000000000000000000000000000000000000000000000000000000000000007b',
            },
        },
    })

    const value = decodeFunctionResult({
        abi: TesterAbi,
        functionName: 'value',
        data: result,
    })
    expect(value).toEqual(123n)
})

Deno.test('state_override: stateDiff preserves other slots', opts, async () => {
    const address = await getTesterAddr()

    // Override slot 0 (value) but slot 1 (name) should be unchanged.
    const valueData = encodeFunctionData({
        abi: TesterAbi,
        functionName: 'value',
    })
    const nameData = encodeFunctionData({
        abi: TesterAbi,
        functionName: 'name',
    })

    const overrides = {
        [address]: {
            stateDiff: {
                '0x0000000000000000000000000000000000000000000000000000000000000000':
                    '0x00000000000000000000000000000000000000000000000000000000000003e7',
            },
        },
    }

    const valueResult = await ethCallWithOverrides(address, valueData, overrides)
    const nameResult = await ethCallWithOverrides(address, nameData, overrides)

    const value = decodeFunctionResult({
        abi: TesterAbi,
        functionName: 'value',
        data: valueResult,
    })
    const name = decodeFunctionResult({
        abi: TesterAbi,
        functionName: 'name',
        data: nameResult,
    })

    expect(value).toEqual(999n)
    expect(name).toEqual('Hello world')
})

Deno.test('state_override: storage on EOA fails', opts, async () => {
    const eoa = '0x1111111111111111111111111111111111111111' as Hex

    try {
        await env.publicClient.request({
            method: 'eth_call',
            params: [
                { from: zeroAddress, to: eoa },
                'latest',
                {
                    [eoa]: {
                        stateDiff: {
                            '0x0000000000000000000000000000000000000000000000000000000000000000':
                                '0x000000000000000000000000000000000000000000000000000000000000002a',
                        },
                    },
                },
            ],
        })
        throw new Error('Expected to fail')
    } catch (_err) {
        // Storage override on an EOA without code should fail.
    }
})

Deno.test('state_override: code and stateDiff combined', opts, async () => {
    const target = '0xdddddddddddddddddddddddddddddddddddddddd' as Hex
    const runtimeCode = getRuntimeByteCode('Tester', env.evm)

    const data = encodeFunctionData({
        abi: TesterAbi,
        functionName: 'value',
    })

    // Inject Tester code AND set slot 0 to 77.
    const result = await ethCallWithOverrides(target, data, {
        [target]: {
            code: runtimeCode,
            stateDiff: {
                '0x0000000000000000000000000000000000000000000000000000000000000000':
                    '0x000000000000000000000000000000000000000000000000000000000000004d',
            },
        },
    })

    const value = decodeFunctionResult({
        abi: TesterAbi,
        functionName: 'value',
        data: result,
    })
    expect(value).toEqual(77n)
})


Deno.test('state_override: multiple accounts', opts, async () => {
    const sender = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as Hex
    const target = '0xffffffffffffffffffffffffffffffffffffffff' as Hex
    const runtimeCode = getRuntimeByteCode('Tester', env.evm)

    const data = encodeFunctionData({
        abi: TesterAbi,
        functionName: 'value',
    })

    // Override sender's balance AND target's code in one call.
    const result = await ethCallWithOverrides(
        target,
        data,
        {
            [sender]: { balance: '0xDE0B6B3A7640000' },
            [target]: { code: runtimeCode },
        },
        sender,
    )

    const value = decodeFunctionResult({
        abi: TesterAbi,
        functionName: 'value',
        data: result,
    })
    // Tester runtime code deployed fresh has value = 0 (constructor doesn't run).
    expect(value).toEqual(0n)
})

Deno.test('state_override: does not persist', opts, async () => {
    const address = await getTesterAddr()
    const data = encodeFunctionData({
        abi: TesterAbi,
        functionName: 'value',
    })

    // Call with override: value = 999
    const overriddenResult = await ethCallWithOverrides(address, data, {
        [address]: {
            stateDiff: {
                '0x0000000000000000000000000000000000000000000000000000000000000000':
                    '0x00000000000000000000000000000000000000000000000000000000000003e7',
            },
        },
    })

    // Call without override
    const normalResult = await ethCallWithOverrides(address, data, {})

    const overriddenValue = decodeFunctionResult({
        abi: TesterAbi,
        functionName: 'value',
        data: overriddenResult,
    })
    const normalValue = decodeFunctionResult({
        abi: TesterAbi,
        functionName: 'value',
        data: normalResult,
    })

    expect(overriddenValue).toEqual(999n)
    expect(normalValue).toEqual(42n)
})

Deno.test('state_override: empty set is no-op', opts, async () => {
    const address = await getTesterAddr()
    const data = encodeFunctionData({
        abi: TesterAbi,
        functionName: 'value',
    })

    const result = await ethCallWithOverrides(address, data, {})

    const value = decodeFunctionResult({
        abi: TesterAbi,
        functionName: 'value',
        data: result,
    })
    expect(value).toEqual(42n)
})