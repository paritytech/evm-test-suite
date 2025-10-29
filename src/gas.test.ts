import { Hex, parseEther } from 'viem'
import { getByteCode, getEnv, sanitizeOpts as opts } from './util.ts'
import { expect } from '@std/expect'
import { GasTesterAbi } from '../codegen/abi/GasTester.ts'

// Initialize test environment
const env = await getEnv()

async function verifyTxCost(
    value: bigint,
    executeTx: () => Promise<Hex>,
) {
    const balanceBefore = await env.accountWallet.getBalance(
        env.accountWallet.account,
    )

    const hash = await executeTx()
    const receipt = await env.serverWallet.waitForTransactionReceipt(hash)
    expect(receipt.status).toEqual('success')

    const balanceAfter = await env.accountWallet.getBalance(
        env.accountWallet.account,
    )
    const txCost = receipt.gasUsed * receipt.effectiveGasPrice
    const expectedTxCost = balanceBefore - (balanceAfter + value)

    expect(txCost).toEqual(expectedTxCost)
    return receipt
}

Deno.test('gas cost calculation', opts, async (t) => {
    let contractAddress: Hex

    const success = await t.step('deployment txCost', async () => {
        const value = 0n //parseEther('2')
        const receipt = await verifyTxCost(
            value,
            () =>
                env.accountWallet.deployContract({
                    abi: GasTesterAbi,
                    bytecode: getByteCode('GasTester', env.evm),
                    value,
                }),
        )
        contractAddress = receipt.contractAddress!
    })

    if (!success) {
        return
    }

    await t.step('call txCost', async () => {
        const value = parseEther('10')
        await verifyTxCost(value, async () => {
            const { request } = await env.accountWallet.simulateContract({
                address: contractAddress,
                abi: GasTesterAbi,
                functionName: 'setValue',
                args: [42n],
                value,
            })
            return env.accountWallet.writeContract(request)
        })
    })
})
