import {
    encodeFunctionData,
    Hex,
    hexToBigInt,
    hexToNumber,
    parseEther,
} from 'viem'
import { createEnv, getByteCode, memoizedTx } from './util.ts'
import { expect } from '@std/expect'
import { describe, it } from '@std/testing/bdd'
import { getEnvs } from './test-setup.ts'
import { TesterAbi } from '../abi/Tester.ts'

// Initialize test environments
const envs = await Promise.all(getEnvs().map(createEnv))

for (const env of envs) {
    const getTesterReceipt = memoizedTx(env, () =>
        env.serverWallet.deployContract({
            abi: TesterAbi,
            bytecode: getByteCode('Tester', env.evm),
            value: parseEther('2'),
        })
    )
    const getTesterAddr = () =>
        getTesterReceipt().then((r) => r.contractAddress!)

    describe(env.serverWallet.chain.name, () => {
        it('eth_accounts', async () => {
            const addresses = await env.debugClient.request({
                method: 'eth_accounts',
            })
            expect(addresses).toHaveLength(1)
        })

        it('eth_blockNumber', async () => {
            await getTesterReceipt()
            const res = await env.debugClient.request({
                method: 'eth_blockNumber',
            })
            expect(hexToBigInt(res)).toBeTruthy()
        })

        it('eth_call', async () => {
            const value = await env.serverWallet.readContract({
                address: await getTesterAddr(),
                abi: TesterAbi,
                functionName: 'value',
            })
            expect(value).toEqual(42n)
        })

        it('eth_chainId', async () => {
            const res = await env.debugClient.request({
                method: 'eth_chainId',
            })
            expect(hexToNumber(res)).toEqual(env.chain.id)
        })

        it('eth_estimateGas', async () => {
            const res = await env.serverWallet.estimateContractGas({
                address: await getTesterAddr(),
                abi: TesterAbi,
                functionName: 'setValue',
                args: [43n],
            })

            expect(res).toBeTruthy()
        })

        it('eth_gasPrice', async () => {
            const res = await env.debugClient.request({
                method: 'eth_gasPrice',
            })
            expect(hexToNumber(res)).toBeTruthy()
        })

        it('eth_getBalance', async () => {
            const balance = await env.serverWallet.getBalance({
                address: await getTesterAddr(),
            })
            expect(balance).toEqual(parseEther('2'))
        })

        it('eth_getBlockByHash and eth_getBlockByNumber', async () => {
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

        it('eth_getBlockTransactionCountByHash and eth_getBlockTransactionCountByNumber', async () => {
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

        it('eth_getCode', async () => {
            // Existing contract
            {
                const contractAddr = await getTesterAddr()
                const code = await env.serverWallet.getCode({
                    address: contractAddr,
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
                const code = await env.serverWallet.getCode(
                    env.serverWallet.account
                )

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

        it('eth_getLogs', async () => {
            const { blockHash } = await getTesterReceipt()
            const logs = await env.serverWallet.getLogs({
                blockHash,
            })

            expect(logs).toHaveLength(1)
        })

        it('eth_getStorageAt', async () => {
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

        it('get_transaction_by_block_hash_and_index, eth_getTransactionByBlockNumberAndIndex and eth_getTransactionByHash', async () => {
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

        it('eth_getTransactionCount', async () => {
            const count = await env.serverWallet.getTransactionCount(
                env.serverWallet.account
            )
            expect(count).toBeGreaterThanOrEqual(1)
        })

        it('eth_getTransactionReceipt', async () => {
            const { transactionHash: hash } = await getTesterReceipt()
            const receipt = await env.serverWallet.waitForTransactionReceipt(
                hash
            )
            expect(receipt).toBeTruthy()
        })

        it('eth_maxPriorityFeePerGas', async () => {
            const res: Hex = await env.serverWallet.request({
                // @ts-ignore - eth_maxPriorityFeePerGas is not in the type definitions
                method: 'eth_maxPriorityFeePerGas',
            })
            expect(hexToBigInt(res) >= 0n).toBeTruthy()
        })

        it('eth_sendRawTransaction', async () => {
            const { request } = await env.accountWallet.simulateContract({
                address: await getTesterAddr(),
                abi: TesterAbi,
                functionName: 'setValue',
                args: [42n],
            })
            const hash = await env.accountWallet.writeContract(request)
            const receipt = await env.serverWallet.waitForTransactionReceipt(
                hash
            )
            expect(receipt.status).toEqual('success')
        })

        it('eth_sendTransaction', async () => {
            const hash = await env.serverWallet.sendTransaction({
                to: await getTesterAddr(),
                data: encodeFunctionData({
                    abi: TesterAbi,
                    functionName: 'setValue',
                    args: [42n],
                }),
            })
            const receipt = await env.serverWallet.waitForTransactionReceipt(
                hash
            )
            expect(receipt.status).toEqual('success')
        })

        it('eth_syncing', async () => {
            const res = await env.serverWallet.request({
                method: 'eth_syncing',
            })

            expect(res).toEqual(false)
        })

        it('net_version', async () => {
            const res = await env.serverWallet.request({
                // @ts-ignore - net_version is not in the type definitions
                method: 'net_version',
            })
            expect(res).toBeTruthy()
        })

        it('web3_clientVersion', async () => {
            const res = await env.serverWallet.request({
                // @ts-ignore - web3_clientVersion is not in the type definitions
                method: 'web3_clientVersion',
            })
            expect(res).toBeTruthy()
        })

        it('eth_feeHistory', async () => {
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
