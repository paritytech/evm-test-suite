import {
    jsonRpcErrors,
    getByteCode,
    createEnv,
    memoizedDeploy,
} from './util.ts'
import { afterEach, describe, expect, inject, test } from 'vitest'
import { fail } from 'node:assert'
import { ErrorsAbi } from '../abi/Errors.ts'

afterEach(() => {
    jsonRpcErrors.length = 0
})

const envs = await Promise.all(inject('envs').map(createEnv))
for (const env of envs) {
    const getErrorTesterAddr = memoizedDeploy(env, () =>
        env.serverWallet.deployContract({
            abi: ErrorsAbi,
            bytecode: getByteCode('Errors', env.evm),
        })
    )

    describe(env.serverWallet.chain.name, () => {
        test('triggerAssertError', async () => {
            try {
                await env.accountWallet.readContract({
                    address: await getErrorTesterAddr(),
                    abi: ErrorsAbi,
                    functionName: 'triggerAssertError',
                })
                fail('Expect call to fail')
            } catch (err) {
                const lastJsonRpcError = jsonRpcErrors.pop()
                expect(lastJsonRpcError?.code).toBe(3)
                expect(lastJsonRpcError?.data).toBe(
                    '0x4e487b710000000000000000000000000000000000000000000000000000000000000001'
                )
                expect(lastJsonRpcError?.message).toBeOneOf([
                    'execution reverted: assert(false)',
                    'execution reverted: panic: assertion failed (0x01)',
                ])
            }
        })

        test('triggerRevertError', async () => {
            try {
                await env.accountWallet.readContract({
                    address: await getErrorTesterAddr(),
                    abi: ErrorsAbi,
                    functionName: 'triggerRevertError',
                })
                fail('Expect call to fail')
            } catch (err) {
                const lastJsonRpcError = jsonRpcErrors.pop()
                expect(lastJsonRpcError?.code).toBe(3)
                expect(lastJsonRpcError?.message).toBeOneOf([
                    'execution reverted: This is a revert error',
                    'execution reverted: revert: This is a revert error',
                ])
                expect(lastJsonRpcError?.data).toBe(
                    '0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001654686973206973206120726576657274206572726f7200000000000000000000'
                )
            }
        })

        test('triggerDivisionByZero', async () => {
            try {
                await env.accountWallet.readContract({
                    address: await getErrorTesterAddr(),
                    abi: ErrorsAbi,
                    functionName: 'triggerDivisionByZero',
                })
                expect.assertions(3)
            } catch (err) {
                const lastJsonRpcError = jsonRpcErrors.pop()
                expect(lastJsonRpcError?.code).toBe(3)
                expect(lastJsonRpcError?.data).toBe(
                    '0x4e487b710000000000000000000000000000000000000000000000000000000000000012'
                )
                expect(lastJsonRpcError?.message).toBeOneOf([
                    'execution reverted: division or modulo by zero',
                    'execution reverted: panic: division or modulo by zero (0x12)',
                ])
            }
        })

        test('triggerOutOfBoundsError', async () => {
            try {
                await env.accountWallet.readContract({
                    address: await getErrorTesterAddr(),
                    abi: ErrorsAbi,
                    functionName: 'triggerOutOfBoundsError',
                })
                fail('Expect call to fail')
            } catch (err) {
                const lastJsonRpcError = jsonRpcErrors.pop()
                expect(lastJsonRpcError?.code).toBe(3)
                expect(lastJsonRpcError?.data).toBe(
                    '0x4e487b710000000000000000000000000000000000000000000000000000000000000032'
                )
                expect(lastJsonRpcError?.message).toBeOneOf([
                    'execution reverted: out-of-bounds access of an array or bytesN',
                    'execution reverted: panic: array out-of-bounds access (0x32)',
                ])
            }
        })

        test('triggerCustomError', async () => {
            try {
                await env.accountWallet.readContract({
                    address: await getErrorTesterAddr(),
                    abi: ErrorsAbi,
                    functionName: 'triggerCustomError',
                })
                fail('Expect call to fail')
            } catch (err) {
                const lastJsonRpcError = jsonRpcErrors.pop()
                expect(lastJsonRpcError?.code).toBe(3)
                expect(lastJsonRpcError?.data).toBe(
                    '0x8d6ea8be0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001654686973206973206120637573746f6d206572726f7200000000000000000000'
                )
                expect(lastJsonRpcError?.message).toBe('execution reverted')
            }
        })
    })
}
