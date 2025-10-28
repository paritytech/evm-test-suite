import {
    encodeFunctionData,
    Hex,
    hexToBigInt,
    hexToNumber,
    parseEther,
} from 'viem'
import {
    getByteCode,
    getEnv,
    memoizedTx,
    sanitizeOpts as opts,
} from './util.ts'
import { expect } from '@std/expect'
import { TesterAbi } from '../codegen/abi/Tester.ts'

// Initialize test environment
const env = await getEnv()

const getTesterReceipt = memoizedTx(env, () =>
    env.serverWallet.deployContract({
        abi: TesterAbi,
        bytecode: getByteCode('Tester', env.evm),
        value: parseEther('2'),
    }))
const getTesterAddr = () => getTesterReceipt().then((r) => r.contractAddress!)

Deno.test('eth_accounts', opts, async () => {
    const addresses = await env.debugClient.request({
        method: 'eth_accounts',
    })
    expect(addresses.length).toBeGreaterThanOrEqual(1)
})

Deno.test('eth_blockNumber', opts, async () => {
    const res = await env.debugClient.request({
        method: 'eth_blockNumber',
    })
    expect(hexToBigInt(res) >= 0n).toBeTruthy()
})

Deno.test('eth_call', opts, async () => {
    const value = await env.serverWallet.readContract({
        address: await getTesterAddr(),
        abi: TesterAbi,
        functionName: 'value',
    })
    expect(value).toEqual(42n)
})

Deno.test('eth_chainId', opts, async () => {
    const res = await env.debugClient.request({
        method: 'eth_chainId',
    })
    expect(hexToNumber(res)).toEqual(env.chain.id)
})

Deno.test('eth_estimateGas', opts, async () => {
    const res = await env.serverWallet.estimateContractGas({
        address: await getTesterAddr(),
        abi: TesterAbi,
        functionName: 'setValue',
        args: [43n],
    })

    expect(res).toBeTruthy()
})

Deno.test('eth_gasPrice', opts, async () => {
    const res = await env.debugClient.request({
        method: 'eth_gasPrice',
    })
    expect(hexToNumber(res)).toBeTruthy()
})

Deno.test('eth_getBalance', opts, async () => {
    const balance = await env.serverWallet.getBalance({
        address: await getTesterAddr(),
    })
    expect(balance).toEqual(parseEther('2'))
})

Deno.test('eth_getBlockBy', opts, async () => {
    const { blockNumber, blockHash } = await getTesterReceipt()
    const by_number = await env.serverWallet.getBlock({
        blockNumber,
    })
    expect(by_number).toBeTruthy()

    const by_hash = await env.serverWallet.getBlock({
        blockHash,
    })
    expect(by_hash).toEqual(by_number)
})

Deno.test('eth_getBlockTransactionCount', opts, async (t) => {
    const { blockNumber, blockHash } = await getTesterReceipt()

    await t.step('ByNumber', async () => {
        const count = await env.serverWallet.getBlockTransactionCount({
            blockNumber,
        })
        expect(count).toBeGreaterThanOrEqual(1)
    })

    await t.step('ByHash', async () => {
        const count = await env.serverWallet.getBlockTransactionCount({
            blockHash,
        })

        expect(count).toBeGreaterThanOrEqual(1)
    })
})

Deno.test('eth_getCode', opts, async () => {
    // Existing contract
    {
        const code = await env.serverWallet.getCode({
            address: await getTesterAddr(),
        })

        // Runtime code on EVM
        if (env.evm) {
            expect(code).toBeTruthy()
            // Contract code on revive
        } else {
            expect(code).toEqual(getByteCode('Tester', env.evm))
        }
    }

    // EOA
    {
        const code = await env.serverWallet.getCode(env.serverWallet.account)

        expect(code).toBeUndefined()
    }

    // basic precompiles
    for (let i = 1; i <= 10; i++) {
        const hex = i.toString(16).padStart(40, '0')
        const address: Hex = `0x${hex}`
        const code = await env.serverWallet.getCode({ address })
        expect(code).toBeUndefined()
    }

    // TODO restore when we hit a chain with precompile
    // // ERC20 precompile
    // if (!env.evm) {
    //     const assetPrecompile =
    //         '0x0000000000000000000000000000000000010000'
    //     const code = await env.serverWallet.getCode({
    //         address: assetPrecompile,
    //     })
    //     expect(code).toEqual('0x60006000fd')
    // }
})

Deno.test('eth_getLogs', opts, async () => {
    const { blockHash } = await getTesterReceipt()
    const logs = await env.serverWallet.getLogs({
        blockHash,
    })

    expect(logs).toHaveLength(1)
})

Deno.test('eth_getStorageAt', opts, async () => {
    const address = await getTesterAddr()
    const storage = await env.serverWallet.getStorageAt({
        address,
        slot: '0x01',
    })

    // revive store value as little endian. When this change in the compiler, or the runtime API, we can amend this test
    expect(storage).toEqual(
        '0x48656c6c6f20776f726c64000000000000000000000000000000000000000016',
    )
})

Deno.test('eth_getTransactionBy', opts, async (t) => {
    const {
        transactionHash: hash,
        blockHash,
        transactionIndex: index,
        blockNumber,
    } = await getTesterReceipt()

    const byTxHash = await env.serverWallet.getTransaction({ hash })
    t.step('eth_getTransactionByHash', () => expect(byTxHash).toBeTruthy())

    await t.step('get_transaction_by_block_hash_and_index', async () => {
        const byBlockHash = await env.serverWallet.getTransaction({
            blockHash,
            index,
        })
        expect(byBlockHash).toEqual(byTxHash)
    })

    await t.step('eth_getTransactionByBlockNumberAndIndex', async () => {
        const byBlockNumber = await env.serverWallet.getTransaction({
            blockNumber,
            index,
        })
        expect(byBlockNumber).toEqual(byTxHash)
    })
})

Deno.test('eth_getTransactionCount', opts, async () => {
    const count = await env.serverWallet.getTransactionCount(
        env.serverWallet.account,
    )
    expect(count).toBeGreaterThanOrEqual(1)
})

Deno.test('eth_getTransactionReceipt', opts, async (t) => {
    await t.step('eth_getTransactionReceipt status=success', async () => {
        const { transactionHash: hash } = await getTesterReceipt()
        const receipt = await env.serverWallet.waitForTransactionReceipt(hash)
        expect(receipt).toBeTruthy()
    })

    await t.step('eth_getTransactionReceipt status=reverted', async () => {
        const { gasLimit } = await env.accountWallet.getBlock()
        const hash = await env.accountWallet.writeContract({
            address: await getTesterAddr(),
            abi: TesterAbi,
            functionName: 'revertme',
            gas: gasLimit / 2n,
            args: [],
        })

        const receipt = await env.serverWallet.waitForTransactionReceipt(hash)
        expect(receipt).toBeTruthy()
        expect(receipt.status).toEqual('reverted')
    })
})

Deno.test('eth_maxPriorityFeePerGas', opts, async () => {
    const res: Hex = await env.serverWallet.request({
        // @ts-ignore - eth_maxPriorityFeePerGas is not in the type definitions
        method: 'eth_maxPriorityFeePerGas',
    })
    expect(hexToBigInt(res) >= 0n).toBeTruthy()
})

Deno.test('eth_sendRawTransaction', opts, async () => {
    const balanceBefore = await env.accountWallet.getBalance(
        env.accountWallet.account,
    )

    const value = parseEther('2')
    const { request } = await env.accountWallet.simulateContract({
        address: await getTesterAddr(),
        abi: TesterAbi,
        functionName: 'setValue',
        args: [42n],
        value,
    })
    const hash = await env.accountWallet.writeContract(request)
    const receipt = await env.serverWallet.waitForTransactionReceipt(hash)
    expect(receipt.status).toEqual('success')

    const balanceAfter = await env.accountWallet.getBalance(
        env.accountWallet.account,
    )
    const gasUsed = receipt.gasUsed
    const gasPrice = receipt.effectiveGasPrice
    const txCost = gasUsed * gasPrice + value
    const expectedBalance = balanceBefore - txCost

    expect(balanceAfter).toEqual(expectedBalance)
})

Deno.test('eth_sendTransaction', opts, async () => {
    const hash = await env.serverWallet.sendTransaction({
        to: await getTesterAddr(),
        data: encodeFunctionData({
            abi: TesterAbi,
            functionName: 'setValue',
            args: [42n],
        }),
    })
    const receipt = await env.serverWallet.waitForTransactionReceipt(hash)
    expect(receipt.status).toEqual('success')
})

Deno.test('eth_syncing', opts, async () => {
    const res = await env.serverWallet.request({
        method: 'eth_syncing',
    })

    expect(res).toEqual(false)
})

Deno.test('net_version', opts, async () => {
    const res = await env.serverWallet.request({
        // @ts-ignore - net_version is not in the type definitions
        method: 'net_version',
    })
    expect(res).toBeTruthy()
})

Deno.test('web3_clientVersion', opts, async () => {
    const res = await env.serverWallet.request({
        // @ts-ignore - web3_clientVersion is not in the type definitions
        method: 'web3_clientVersion',
    })
    expect(res).toBeTruthy()
})

Deno.test('eth_feeHistory', opts, async () => {
    const feeHistory = await env.serverWallet.getFeeHistory({
        blockCount: 4,
        blockTag: 'latest',
        rewardPercentiles: [25, 75],
    })

    expect(feeHistory.oldestBlock).toBeGreaterThanOrEqual(0)
    expect(feeHistory.gasUsedRatio.length).toBeGreaterThanOrEqual(0)
    expect(feeHistory.reward?.length).toEqual(feeHistory.gasUsedRatio.length)

    expect(feeHistory.baseFeePerGas).toHaveLength(
        feeHistory.gasUsedRatio.length + 1,
    )
})
