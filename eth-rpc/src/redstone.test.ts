import { ExampleRedstoneShowroomAbi } from '../abi/ExampleRedstoneShowroom.ts'
import { createEnv, getByteCode } from './util.ts'
import { Contract, providers } from 'ethers'
import { WrapperBuilder } from '@redstone-finance/evm-connector'
import { describe, expect, inject, test } from 'vitest'

const envs = await Promise.all(inject('envs').map(createEnv))

for (const env of envs) {
    const hash = await env.serverWallet.deployContract({
        abi: ExampleRedstoneShowroomAbi,
        bytecode: getByteCode('ExampleRedstoneShowroom', env.evm),
    })
    const deployReceipt = await env.serverWallet.waitForTransactionReceipt({
        hash,
    })
    const contractAddress = deployReceipt.contractAddress!

    const provider = new providers.JsonRpcProvider(
        env.chain.rpcUrls.default.http[0],
        {
            name: env.chain.name,
            chainId: env.chain.id,
        }
    )

    describe.runIf(process.env.UNSTABLE)(
        `${env.serverWallet.chain.name}`,
        () => {
            test('getTokensPrices works', async () => {
                const contract = new Contract(
                    contractAddress,
                    ExampleRedstoneShowroomAbi as any,
                    provider
                )
                const wrappedContract = WrapperBuilder.wrap(
                    contract
                ).usingDataService({
                    dataServiceId: 'redstone-rapid-demo',
                    uniqueSignersCount: 1,
                    dataPackagesIds: [
                        'BTC',
                        'ETH',
                        'BNB',
                        'AR',
                        'AVAX',
                        'CELO',
                    ],
                })
                const tokenPrices = await wrappedContract.getPrices()
                expect(tokenPrices).toHaveLength(6)
            })
        }
    )
}
