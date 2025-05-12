import { ExampleRedstoneShowroomAbi } from '../abi/ExampleRedstoneShowroom.ts'
import { createEnv, memoizedDeploy, getByteCode } from './util.ts'
import { Contract, providers } from 'ethers'
import { WrapperBuilder } from '@redstone-finance/evm-connector'
import { describe, expect, inject, test } from 'vitest'

const envs = await Promise.all(inject('envs').map(createEnv))

for (const env of envs) {
    const provider = new providers.JsonRpcProvider(
        env.chain.rpcUrls.default.http[0],
        {
            name: env.chain.name,
            chainId: env.chain.id,
        }
    )

    const getContractAddr = memoizedDeploy(env, () =>
        env.serverWallet.deployContract({
            abi: ExampleRedstoneShowroomAbi,
            bytecode: getByteCode('ExampleRedstoneShowroom', env.evm),
        })
    )

    describe(`${env.serverWallet.chain.name}`, () => {
        test('getTokensPrices works', async () => {
            const contract = new Contract(
                await getContractAddr(),
                ExampleRedstoneShowroomAbi as any,
                provider
            )
            const wrappedContract = WrapperBuilder.wrap(
                contract
            ).usingDataService({
                dataServiceId: 'redstone-rapid-demo',
                uniqueSignersCount: 1,
                dataPackagesIds: ['BTC', 'ETH', 'BNB', 'AR', 'AVAX', 'CELO'],
            })
            const tokenPrices = await wrappedContract.getPrices()
            expect(tokenPrices).toHaveLength(6)
        })
    })
}
