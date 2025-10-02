import {
    jsonRpcErrors,
    getByteCode,
    createEnv,
    memoizedDeploy,
} from './util.ts'
import { afterEach, describe, expect, inject, test } from 'vitest'
import { fail } from 'node:assert'

import { encodeFunctionData, parseEther, decodeEventLog } from 'viem'
import { ErrorsAbi } from '../abi/Errors.ts'
import { EventExampleAbi } from '../abi/EventExample.ts'

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

    const getEventExampleAddr = memoizedDeploy(env, async () =>
        env.serverWallet.deployContract({
            abi: EventExampleAbi,
            bytecode: getByteCode('EventExample', env.evm),
        })
    )

    describe(env.serverWallet.chain.name, () => {
        test('eth_call (not enough funds)', async () => {
            try {
                await env.emptyWallet.simulateContract({
                    address: await getErrorTesterAddr(),
                    abi: ErrorsAbi,
                    functionName: 'valueMatch',
                    value: parseEther('10'),
                    args: [parseEther('10')],
                })
                fail('Expect call to fail')
            } catch (err) {
                const lastJsonRpcError = jsonRpcErrors.pop()
                expect(lastJsonRpcError?.code).toBe(-32000)
                expect(lastJsonRpcError?.message).to.include(
                    'insufficient funds'
                )
                expect(lastJsonRpcError?.data).toBeUndefined()
            }
        })

        test('eth_call transfer (not enough funds)', async () => {
            const value = parseEther('10')
            const balance = await env.emptyWallet.getBalance(
                env.emptyWallet.account
            )
            expect(balance, 'Balance should be less than 10').toBeLessThan(
                value
            )
            try {
                await env.emptyWallet.sendTransaction({
                    to: '0x75E480dB528101a381Ce68544611C169Ad7EB342',
                    value,
                })
                fail('Expect call to fail')
            } catch (err) {
                const lastJsonRpcError = jsonRpcErrors.pop()
                expect(lastJsonRpcError?.code).toBe(-32000)
                expect(lastJsonRpcError?.message).to.include(
                    'insufficient funds'
                )
                expect(lastJsonRpcError?.data).toBeUndefined()
            }
        })

        test('eth_estimate (not enough funds)', async () => {
            try {
                await env.emptyWallet.estimateContractGas({
                    address: await getErrorTesterAddr(),
                    abi: ErrorsAbi,
                    functionName: 'valueMatch',
                    value: parseEther('10'),
                    args: [parseEther('10')],
                })
                fail('Expect call to fail')
            } catch (err) {
                const lastJsonRpcError = jsonRpcErrors.pop()
                expect(lastJsonRpcError?.code).toBe(-32000)
                expect(lastJsonRpcError?.message).to.include(
                    'insufficient funds'
                )
                expect(lastJsonRpcError?.data).toBeUndefined()
            }
        })

        test('eth_estimate call caller (not enough funds)', async () => {
            try {
                await env.emptyWallet.estimateContractGas({
                    address: await getErrorTesterAddr(),
                    abi: ErrorsAbi,
                    functionName: 'valueMatch',
                    value: parseEther('10'),
                    args: [parseEther('10')],
                })
                fail('Expect call to fail')
            } catch (err) {
                const lastJsonRpcError = jsonRpcErrors.pop()
                expect(lastJsonRpcError?.code).toBe(-32000)
                expect(lastJsonRpcError?.message).to.include(
                    'insufficient funds'
                )
                expect(lastJsonRpcError?.data).toBeUndefined()
            }
        })

        test('eth_estimate (revert)', async () => {
            try {
                await env.serverWallet.estimateContractGas({
                    address: await getErrorTesterAddr(),
                    abi: ErrorsAbi,
                    functionName: 'valueMatch',
                    value: parseEther('11'),
                    args: [parseEther('10')],
                })
                fail('Expect call to fail')
            } catch (err) {
                const lastJsonRpcError = jsonRpcErrors.pop()
                expect(lastJsonRpcError?.code).toBe(3)
                expect(lastJsonRpcError?.message).toBeOneOf([
                    'execution reverted: msg.value does not match value',
                    'execution reverted: revert: msg.value does not match value',
                ])
                expect(lastJsonRpcError?.data).toBe(
                    '0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001e6d73672e76616c756520646f6573206e6f74206d617463682076616c75650000'
                )
            }
        })

        test('eth_get_balance (no account)', async () => {
            const balance = await env.serverWallet.getBalance({
                address: '0x0000000000000000000000000000000000000123',
            })
            expect(balance).toBe(0n)
        })

        test.only('eth_estimate (not enough funds to cover gas specified)', async () => {
            let balance = await env.serverWallet.getBalance(
                env.emptyWallet.account
            )
            expect(balance).toBe(0n)
            try {
                await env.emptyWallet.estimateContractGas({
                    address: await getErrorTesterAddr(),
                    abi: ErrorsAbi,
                    functionName: 'setState',
                    args: [true],
                })
                fail('Expect call to fail')
            } catch (err) {
                const lastJsonRpcError = jsonRpcErrors.pop()
                expect(lastJsonRpcError?.code).toBe(-32000)
                expect(lastJsonRpcError?.message).to.include(
                    'insufficient funds'
                )
                expect(lastJsonRpcError?.data).toBeUndefined()
            }
        })

        test('eth_estimate (no gas specified)', async () => {
            let balance = await env.serverWallet.getBalance(
                env.emptyWallet.account
            )
            expect(balance).toBe(0n)

            const data = encodeFunctionData({
                abi: ErrorsAbi,
                functionName: 'setState',
                args: [true],
            })

            await env.emptyWallet.request({
                method: 'eth_estimateGas',
                params: [
                    {
                        data,
                        from: env.emptyWallet.account.address,
                        to: await getErrorTesterAddr(),
                    },
                ],
            })
        })

        test('logs', async () => {
            let address = await getEventExampleAddr()
            let { request } = await env.serverWallet.simulateContract({
                address,
                abi: EventExampleAbi,
                functionName: 'triggerEvent',
            })

            let hash = await env.serverWallet.writeContract(request)
            let receipt = await env.serverWallet.waitForTransactionReceipt({
                hash,
            })
            const logs = await env.serverWallet.getLogs({
                address,
                blockHash: receipt.blockHash,
            })
            expect(logs).toHaveLength(1)
            expect(logs[0]).toMatchObject({
                address,
                data: '0x00000000000000000000000000000000000000000000000000000000000030390000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000b48656c6c6f20776f726c64000000000000000000000000000000000000000000',
                transactionHash: hash,
            })

            expect(
                decodeEventLog({
                    abi: EventExampleAbi,
                    data: logs[0].data,
                    topics: logs[0].topics,
                })
            ).toEqual({
                eventName: 'ExampleEvent',
                args: {
                    sender: env.serverWallet.account.address,
                    value: 12345n,
                    message: 'Hello world',
                },
            })
        })
    })
}
