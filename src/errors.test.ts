import { getByteCode, getEnv, jsonRpcErrors } from './util.ts'
import { expect } from '@std/expect'
import { ErrorsAbi } from '../abi/Errors.ts'
import { sanitizeOpts as opts } from './test-setup.ts'
import type { Hex } from 'viem'

// Initialize test environment
const env = await getEnv()
let errorTesterAddr: Hex

Deno.test.beforeAll(async () => {
    const hash = await env.serverWallet.deployContract({
        abi: ErrorsAbi,
        bytecode: getByteCode('Errors', env.evm),
    })
    const receipt = await env.serverWallet.waitForTransactionReceipt(hash)
    errorTesterAddr = receipt.contractAddress!
})

Deno.test('triggerAssertError', opts, async () => {
    try {
        await env.accountWallet.readContract({
            address: errorTesterAddr,
            abi: ErrorsAbi,
            functionName: 'triggerAssertError',
        })
        throw new Error('Expect call to fail')
    } catch (_err) {
        const lastJsonRpcError = jsonRpcErrors.pop()
        expect(lastJsonRpcError?.code).toBe(3)
        expect(lastJsonRpcError?.data).toBe(
            '0x4e487b710000000000000000000000000000000000000000000000000000000000000001',
        )
        expect([
            'execution reverted: assert(false)',
            'execution reverted: panic: assertion failed (0x01)',
        ]).toContain(lastJsonRpcError?.message)
    }
})

Deno.test('triggerRevertError', opts, async () => {
    try {
        await env.accountWallet.readContract({
            address: errorTesterAddr,
            abi: ErrorsAbi,
            functionName: 'triggerRevertError',
        })
        throw new Error('Expect call to fail')
    } catch (_err) {
        const lastJsonRpcError = jsonRpcErrors.pop()
        expect(lastJsonRpcError?.code).toBe(3)
        expect([
            'execution reverted: This is a revert error',
            'execution reverted: revert: This is a revert error',
        ]).toContain(lastJsonRpcError?.message)
        expect(lastJsonRpcError?.data).toBe(
            '0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001654686973206973206120726576657274206572726f7200000000000000000000',
        )
    }
})

Deno.test('triggerDivisionByZero', opts, async () => {
    try {
        await env.accountWallet.readContract({
            address: errorTesterAddr,
            abi: ErrorsAbi,
            functionName: 'triggerDivisionByZero',
        })
        throw new Error('Expect call to fail')
    } catch (_err) {
        const lastJsonRpcError = jsonRpcErrors.pop()
        expect(lastJsonRpcError?.code).toBe(3)
        expect(lastJsonRpcError?.data).toBe(
            '0x4e487b710000000000000000000000000000000000000000000000000000000000000012',
        )
        expect([
            'execution reverted: division or modulo by zero',
            'execution reverted: panic: division or modulo by zero (0x12)',
        ]).toContain(lastJsonRpcError?.message)
    }
})

Deno.test('triggerOutOfBoundsError', opts, async () => {
    try {
        await env.accountWallet.readContract({
            address: errorTesterAddr,
            abi: ErrorsAbi,
            functionName: 'triggerOutOfBoundsError',
        })
        throw new Error('Expect call to fail')
    } catch (_err) {
        const lastJsonRpcError = jsonRpcErrors.pop()
        expect(lastJsonRpcError?.code).toBe(3)
        expect(lastJsonRpcError?.data).toBe(
            '0x4e487b710000000000000000000000000000000000000000000000000000000000000032',
        )
        expect([
            'execution reverted: out-of-bounds access of an array or bytesN',
            'execution reverted: panic: array out-of-bounds access (0x32)',
        ]).toContain(lastJsonRpcError?.message)
    }
})

Deno.test('triggerCustomError', opts, async () => {
    try {
        await env.accountWallet.readContract({
            address: errorTesterAddr,
            abi: ErrorsAbi,
            functionName: 'triggerCustomError',
        })
        throw new Error('Expect call to fail')
    } catch (_err) {
        const lastJsonRpcError = jsonRpcErrors.pop()
        expect(lastJsonRpcError?.code).toBe(3)
        expect(lastJsonRpcError?.data).toBe(
            '0x8d6ea8be0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001654686973206973206120637573746f6d206572726f7200000000000000000000',
        )
        expect(lastJsonRpcError?.message).toBe('execution reverted')
    }
})
