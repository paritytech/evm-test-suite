import {
    getByteCode,
    createEnv,
    deployFactory,
    visit,
    fixture,
    Visitor,
    writeFixture,
    computeMappingSlot,
} from './util.ts'
import { expect, inject, test } from 'vitest'
import { encodeFunctionData, parseEther } from 'viem'
import { PretraceFixtureAbi } from '../abi/PretraceFixture.ts'
import { TracingCalleeAbi } from '../abi/TracingCallee.ts'

const envs = await Promise.all(inject('envs').map(createEnv))
for (const env of envs) {
    const [getAddr] = deployFactory(env, async () =>
        env.serverWallet.deployContract({
            abi: TracingCalleeAbi,
            bytecode: getByteCode('PretraceFixture', env.evm),
            value: parseEther('10'),
        })
    )

    const [getAddr2] = deployFactory(env, async () =>
        env.serverWallet.deployContract({
            abi: TracingCalleeAbi,
            bytecode: getByteCode('PretraceFixture', env.evm),
            value: parseEther('5'),
        })
    )

    const getVisitor = async (): Promise<Visitor> => {
        let { miner: coinbaseAddr } = await env.publicClient.getBlock({
            blockTag: 'latest',
        })

        const walletbalanceStorageSlot = await computeMappingSlot(
            env.serverWallet.account.address,
            1
        )
        let mappedKeys = {
            [walletbalanceStorageSlot]: `<wallet_balance>`,
            [coinbaseAddr]: `<coinbase_addr>`,
            [await getAddr()]: `<contract_addr>`,
            [await getAddr2()]: `<contract_addr_2>`,
        }

        return (key, value) => {
            key = mappedKeys[key] ?? key
            switch (key) {
                case 'code': {
                    return [key, '<code>']
                }
                case 'nonce': {
                    return [key, '<nonce>']
                }
                case 'balance': {
                    return [key, '<balance>']
                }
                default: {
                    return [key, value]
                }
            }
        }
    }

    const matchFixture = async (res: any, fixtureName: string) => {
        const visitor = await getVisitor()
        res = visit(res, visitor)
        if (process.env.WRITE_FIXTURES) {
            console.warn(`Updating fixture: ${fixtureName}`)
            writeFixture(`prestate_${fixtureName}`, res)
        } else {
            expect(res).toEqual(fixture(`prestate_${fixtureName}`))
        }
    }

    test('write_storage', async () => {
        const res = await env.debugClient.traceCall(
            {
                to: await getAddr(),
                data: encodeFunctionData({
                    abi: PretraceFixtureAbi,
                    functionName: 'writeStorage',
                    args: [2n],
                }),
            },
            'prestateTracer',
            { diffMode: false, disableCode: true }
        )

        await matchFixture(res, 'write_storage')
    })

    test('read_storage', async () => {
        const res = await env.debugClient.traceCall(
            {
                to: await getAddr(),
                data: encodeFunctionData({
                    abi: PretraceFixtureAbi,
                    functionName: 'readStorage',
                }),
            },
            'prestateTracer',
            { diffMode: false, disableCode: true }
        )

        await matchFixture(res, 'read_storage')
    })

    test('deposit', async () => {
        const res = await env.debugClient.traceCall(
            {
                to: await getAddr(),
                from: env.serverWallet.account.address,
                value: parseEther('1'),
                data: encodeFunctionData({
                    abi: PretraceFixtureAbi,
                    functionName: 'deposit',
                }),
            },
            'prestateTracer',
            { diffMode: false, disableCode: true }
        )

        await matchFixture(res, 'deposit')
    })

    test('withdraw', async () => {
        const res = await env.debugClient.traceCall(
            {
                to: await getAddr(),
                from: env.serverWallet.account.address,
                value: parseEther('1'),
                data: encodeFunctionData({
                    abi: PretraceFixtureAbi,
                    functionName: 'deposit',
                }),
            },
            'prestateTracer',
            { diffMode: false, disableCode: true }
        )

        await matchFixture(res, 'withdraw')
    })

    test('get_balance', async () => {
        const res = await env.debugClient.traceCall(
            {
                to: await getAddr(),
                data: encodeFunctionData({
                    abi: PretraceFixtureAbi,
                    functionName: 'getContractBalance',
                }),
            },
            'prestateTracer',
            { diffMode: false, disableCode: true }
        )

        await matchFixture(res, 'get_balance')
    })

    test('get_external_balance', async () => {
        const addr = await getAddr2()
        const res = await env.debugClient.traceCall(
            {
                to: await getAddr(),
                data: encodeFunctionData({
                    abi: PretraceFixtureAbi,
                    functionName: 'getExternalBalance',
                    args: [addr],
                }),
            },
            'prestateTracer',
            { diffMode: false }
        )

        await matchFixture(res, 'get_external_balance')
    })

    test('deploy_contract', async () => {
        const res = await env.debugClient.traceCall(
            {
                to: await getAddr(),
                from: env.serverWallet.account.address,
                value: parseEther('1'),
                data: encodeFunctionData({
                    abi: PretraceFixtureAbi,
                    functionName: 'createChild',
                }),
            },
            'prestateTracer',
            { diffMode: false }
        )

        await matchFixture(res, 'deploy_contract')
    })
}
