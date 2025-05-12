import {
    encodeFunctionData,
    Hex,
    hexToBigInt,
    hexToNumber,
    parseEther,
} from 'viem'
import { createEnv, getByteCode, memoizedTx } from './util.ts'
import { describe, expect, inject, test } from 'vitest'
import { TesterAbi } from '../abi/Tester.ts'

const envs = await Promise.all(inject('envs').map(createEnv))

for (const env of envs) {
    const getTesterReceipt = memoizedTx(env, async () =>
        env.serverWallet.deployContract({
            abi: TesterAbi,
            bytecode: getByteCode('Tester', env.evm),
            value: parseEther('2'),
        })
    )
    const getTesterAddr = () =>
        getTesterReceipt().then((r) => r.contractAddress!)

    describe(`${env.serverWallet.chain.name}`, () => {
        test('eth_accounts works', async () => {
            const addresses = await env.debugClient.request({
                method: 'eth_accounts',
            })
            expect(addresses).toHaveLength(1)
        })

        test('eth_blockNumber works', async () => {
            await getTesterReceipt()
            const res = await env.debugClient.request({
                method: 'eth_blockNumber',
            })
            expect(hexToBigInt(res)).toBeTruthy()
        })

        test('eth_call works', async () => {
            const value = await env.serverWallet.readContract({
                address: await getTesterAddr(),
                abi: TesterAbi,
                functionName: 'value',
            })
            expect(value).toEqual(42n)
        })

        test('eth_chainId works', async () => {
            const res = await env.debugClient.request({
                method: 'eth_chainId',
            })
            expect(hexToNumber(res)).toEqual(env.chain.id)
        })

        test('eth_estimateGas works', async () => {
            const res = await env.serverWallet.estimateContractGas({
                address: await getTesterAddr(),
                abi: TesterAbi,
                functionName: 'setValue',
                args: [43n],
            })

            expect(res).toBeTruthy()
        })

        test('eth_gasPrice works', async () => {
            const res = await env.debugClient.request({
                method: 'eth_gasPrice',
            })
            expect(hexToNumber(res)).toBeTruthy()
        })

        test('eth_getBalance works', async () => {
            const balance = await env.serverWallet.getBalance({
                address: await getTesterAddr(),
            })
            expect(balance).toEqual(parseEther('2'))
        })

        test('eth_getBlockByHash and eth_getBlockByNumber works', async () => {
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

        test('eth_getBlockTransactionCountByHash and eth_getBlockTransactionCountByNumber works', async () => {
            const { blockNumber, blockHash } = await getTesterReceipt()
            const byNumber = await env.serverWallet.getBlockTransactionCount({
                blockNumber,
            })

            const byHash = await env.serverWallet.getBlockTransactionCount({
                blockHash,
            })

            expect(byNumber).toEqual(byHash)
            expect(byNumber).toBeGreaterThanOrEqual(1)
        })

        test('eth_getCode works', async () => {
            const address = await getTesterAddr()
            const code = await env.serverWallet.getCode({
                address,
            })

            if (env.evm) {
                expect(code).toBeTruthy()
            } else {
                expect(code).toEqual(getByteCode('Tester', env.evm))
            }
        })

        test('eth_getLogs works', async () => {
            const { blockHash } = await getTesterReceipt()
            const logs = await env.serverWallet.getLogs({
                blockHash,
            })

            expect(logs).toHaveLength(1)
        })

        test('eth_getStorageAt works', async () => {
            const address = await getTesterAddr()
            const storage = await env.serverWallet.getStorageAt({
                address,
                slot: '0x01',
            })

            // revive store value as little endian. When this change in the compiler, or the runtime API, we can amend this test
            expect(storage).toEqual(
                '0x48656c6c6f20776f726c64000000000000000000000000000000000000000016'
            )
        })

        test('get_transaction_by_block_hash_and_index, eth_getTransactionByBlockNumberAndIndex and eth_getTransactionByHash works', async () => {
            const {
                transactionHash: hash,
                blockHash,
                transactionIndex: index,
                blockNumber,
            } = await getTesterReceipt()
            const byTxHash = await env.serverWallet.getTransaction({ hash })
            expect(byTxHash).toBeTruthy()
            const byBlockHash = await env.serverWallet.getTransaction({
                blockHash,
                index,
            })
            expect(byBlockHash).toEqual(byTxHash)
            const byBlockNumber = await env.serverWallet.getTransaction({
                blockNumber,
                index,
            })
            expect(byBlockNumber).toEqual(byTxHash)
        })

        test('eth_getTransactionCount works', async () => {
            const count = await env.serverWallet.getTransactionCount(
                env.serverWallet.account
            )
            expect(count).toBeGreaterThanOrEqual(1)
        })

        test('eth_getTransactionReceipt works', async () => {
            const { transactionHash: hash } = await getTesterReceipt()
            const receipt = await env.serverWallet.waitForTransactionReceipt({
                hash,
            })
            expect(receipt).toBeTruthy()
        })

        test('eth_maxPriorityFeePerGas works', async () => {
            const res: Hex = await env.serverWallet.request({
                method: 'eth_maxPriorityFeePerGas' as any,
            })
            expect(hexToBigInt(res)).toBeTruthy()
        })

        test('eth_sendRawTransaction works', async () => {
            const { request } = await env.accountWallet.simulateContract({
                address: await getTesterAddr(),
                abi: TesterAbi,
                functionName: 'setValue',
                args: [42n],
            })
            const hash = await env.accountWallet.writeContract(request)
            let receipt = await env.serverWallet.waitForTransactionReceipt({
                hash,
            })
            expect(receipt.status).toEqual('success')
        })

        test('eth_sendTransaction works', async () => {
            const hash = await env.serverWallet.sendTransaction({
                to: await getTesterAddr(),
                data: encodeFunctionData({
                    abi: TesterAbi,
                    functionName: 'setValue',
                    args: [42n],
                }),
            })
            let receipt = await env.serverWallet.waitForTransactionReceipt({
                hash,
            })
            expect(receipt.status).toEqual('success')
        })

        test('eth_syncing works', async () => {
            const res = await env.serverWallet.request({
                method: 'eth_syncing',
            })

            expect(res).toEqual(false)
        })

        test('net_version works', async () => {
            const res = await env.serverWallet.request({
                method: 'net_version' as any,
            })
            expect(res).toBeTruthy()
        })

        test('web3_clientVersion works', async () => {
            const res = await env.serverWallet.request({
                method: 'web3_clientVersion' as any,
            })
            expect(res).toBeTruthy()
        })

        test('eth_feeHistory works', async () => {
            // just to get some transactions
            await getTesterAddr()

            const feeHistory = await env.serverWallet.getFeeHistory({
                blockCount: 4,
                blockTag: 'latest',
                rewardPercentiles: [25, 75],
            })

            expect(feeHistory.oldestBlock).toBeGreaterThanOrEqual(0)
            expect(feeHistory.gasUsedRatio.length).toBeGreaterThanOrEqual(0)
            expect(feeHistory.reward?.length).toEqual(
                feeHistory.gasUsedRatio.length
            )

            expect(feeHistory.baseFeePerGas).toHaveLength(
                feeHistory.gasUsedRatio.length + 1
            )
        })
    })
}
