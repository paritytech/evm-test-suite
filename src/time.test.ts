import { encodeFunctionData } from 'viem'
import {
    getByteCode,
    getEnv,
    jsonRpcErrors,
    memoizedTx,
    sanitizeOpts as opts,
} from './util.ts'
import { expect } from '@std/expect'
import { TimeAbi } from '../codegen/abi/Time.ts'

// Initialize test environment
const env = await getEnv()

const getTimeReceipt = memoizedTx(env, () =>
    env.serverWallet.deployContract({
        abi: TimeAbi,
        bytecode: getByteCode('Time', env.evm),
    }))

const getTimeAddr = () => getTimeReceipt().then((r) => r.contractAddress!)

Deno.test('deployment time is the block time', opts, async () => {
    const receipt = await getTimeReceipt()
    const block = await env.serverWallet.getBlock({
        blockNumber: receipt.blockNumber,
    })
    const deployTime = await env.serverWallet.readContract({
        address: receipt.contractAddress!,
        abi: TimeAbi,
        functionName: 'eta',
    })

    expect(deployTime).toEqual(block.timestamp)
})

// Test that sending a transaction to update the time works with the current time after eta
Deno.test('sendTransaction succeeds', opts, async () => {
    const address = await getTimeAddr()

    const newEta = Math.floor(Date.now() / 1000)
    // wait for 1 second to ensure current time is after newEta
    await new Promise((resolve) => setTimeout(resolve, 1000))

    await env.serverWallet.sendTransaction({
        to: address,
        data: encodeFunctionData({
            abi: TimeAbi,
            functionName: 'setEta',
            args: [BigInt(newEta)],
        }),
    })

    // get the local timestamp
    const currentTime = Math.floor(Date.now() / 1000)

    expect(currentTime).toBeGreaterThanOrEqual(Number(newEta))

    // call update
    const txHash = await env.serverWallet.sendTransaction({
        to: address,
        data: encodeFunctionData({
            abi: TimeAbi,
            functionName: 'update',
        }),
    })
    expect(txHash).toBeTruthy()

    const latestBlock = await env.serverWallet.getBlock()

    const updatedEta = await env.serverWallet.readContract({
        address: address,
        abi: TimeAbi,
        functionName: 'eta',
    })
    expect(updatedEta).toEqual(BigInt(latestBlock.timestamp))
})

// Test that eth_call with blockTag 'pending' works with the current time after eta
Deno.test('eth_call (pending) succeeds', opts, async () => {
    const address = await getTimeAddr()

    const newEta = Math.floor(Date.now() / 1000) + 1

    await env.serverWallet.sendTransaction({
        to: address,
        data: encodeFunctionData({
            abi: TimeAbi,
            functionName: 'setEta',
            args: [BigInt(newEta)],
        }),
    })
    // wait for 2 seconds to ensure current time is after newEta
    await new Promise((resolve) => setTimeout(resolve, 2000))
    // get the local timestamp
    const currentTime = Math.floor(Date.now() / 1000)

    expect(currentTime).toBeGreaterThanOrEqual(Number(newEta))

    // call update
    await env.serverWallet.call({
        to: address,
        data: encodeFunctionData({
            abi: TimeAbi,
            functionName: 'update',
        }),
        blockTag: 'pending',
    })
})

// Test that eth_call with blockTag 'pending' succeeds if the current time is after eta
Deno.test('eth_estimateGas (pending) succeeds', opts, async () => {
    const contractAddress = await getTimeAddr()
    const contract_eta = await env.serverWallet.readContract({
        address: contractAddress,
        abi: TimeAbi,
        functionName: 'eta',
    })
    const currentTime = Math.floor(Date.now() / 1000)

    expect(currentTime).toBeGreaterThan(Number(contract_eta))

    // default block tag for estimateGas is 'pending'
    await env.serverWallet.estimateContractGas({
        address: contractAddress,
        abi: TimeAbi,
        functionName: 'update',
    })
})

// Test that eth_estimateGas with blockTag 'latest' reverts if the current time is after eta
Deno.test(
    'eth_estimateGas (latest) reverts',
    opts,
    async () => {
        try {
            const contractAddress = await getTimeAddr()
            const contract_eta = await env.serverWallet.readContract({
                address: contractAddress,
                abi: TimeAbi,
                functionName: 'eta',
            })
            const currentTime = Math.floor(Date.now() / 1000)

            expect(currentTime).toBeGreaterThan(Number(contract_eta))

            await env.serverWallet.estimateContractGas({
                address: contractAddress,
                abi: TimeAbi,
                functionName: 'update',
                blockTag: 'latest',
            })
        } catch (_err) {
            const lastJsonRpcError = jsonRpcErrors.pop()
            expect(lastJsonRpcError?.code).toBe(3)
            expect(lastJsonRpcError?.message).toContain(
                'Cannot update: Not enough time has passed',
            )
        }
    },
)

// Test that eth_estimateGas with blockTag 'pending' reverts if the current time is before eta
Deno.test(
    'eth_estimateGas (pending) reverts',
    opts,
    async () => {
        try {
            const contractAddress = await getTimeAddr()
            const contract_eta = await env.serverWallet.readContract({
                address: contractAddress,
                abi: TimeAbi,
                functionName: 'eta',
            })

            // Get a new eta that is in the future
            const newEta = Math.floor(Date.now() / 1000) + 1000

            expect(newEta).toBeGreaterThan(Number(contract_eta))
            const tx = await env.serverWallet.sendTransaction({
                to: contractAddress,
                data: encodeFunctionData({
                    abi: TimeAbi,
                    functionName: 'setEta',
                    args: [BigInt(newEta)],
                }),
            })
            expect(tx).toBeTruthy()

            const updatedEta = await env.serverWallet.readContract({
                address: contractAddress,
                abi: TimeAbi,
                functionName: 'eta',
            })
            expect(updatedEta).toEqual(BigInt(newEta))

            // default block tag for estimateGas is 'pending'
            await env.serverWallet.estimateContractGas({
                address: contractAddress,
                abi: TimeAbi,
                functionName: 'update',
            })

            throw new Error('Expect call to fail')
        } catch (_err) {
            const lastJsonRpcError = jsonRpcErrors.pop()
            expect(lastJsonRpcError?.code).toBe(3)
            expect(lastJsonRpcError?.message).toContain(
                'Cannot update: Not enough time has passed',
            )
        }
    },
)
