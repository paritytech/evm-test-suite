#!/usr/bin/env -S deno run --env-file --allow-all

import { getByteCode, getEnv, wait, waitForHealth } from './util.ts'
import { FlipperAbi } from '../codegen/abi/Flipper.ts'

await waitForHealth('http://localhost:8545').catch()
const env = await getEnv()
const wallet = env.accountWallet

console.log('🚀 Deploy flipper...')
const hash = await wallet.deployContract({
    abi: FlipperAbi,
    bytecode: getByteCode('Flipper', env.evm),
})

const deployReceipt = await wallet.waitForTransactionReceipt(hash)
if (!deployReceipt.contractAddress) {
    throw new Error('Contract address should be set')
}
const flipperAddr = deployReceipt.contractAddress

let nonce = await wallet.getTransactionCount(wallet.account)

setInterval(async () => {
    await env.serverWallet.getFeeHistory({
        blockCount: 4,
        blockTag: 'latest',
        rewardPercentiles: [25, 75],
    })
}, 10)

setInterval(async () => {
    await Promise.all([
        env.serverWallet.getBlock({
            blockTag: 'latest',
        }),
        env.serverWallet.getBlock({
            blockTag: 'finalized',
        }),
    ])
}, 10)

console.log('🔄 Starting loop...')
console.log('Starting nonce:', nonce)
try {
    while (true) {
        console.log(`Call flip (nonce: ${nonce})...`)
        const { request } = await wallet.simulateContract({
            account: wallet.account,
            address: flipperAddr,
            abi: FlipperAbi,
            functionName: 'flip',
            nonce,
        })

        const hash = await wallet.writeContract(request)
        console.time(hash)
        wallet.waitForTransactionReceipt(hash).then((receipt) => {
            console.timeEnd(hash)
            console.log('-----------------------------------')
            console.log(`status: ${receipt.status ? '✅' : '❌'}`)
            console.log(
                `block: ${receipt.blockNumber} - hash: ${receipt.blockHash}`,
            )
            console.log(`tx: ${hash}`)
            console.log('-----------------------------------')
        })
        await wait(1_000)
        nonce++
    }
} catch (err) {
    console.error('Failed with error:', err)
}
