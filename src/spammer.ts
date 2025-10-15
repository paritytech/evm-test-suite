import {
    createEnv,
    getByteCode,
    killProcessOnPort,
    wait,
    waitForHealth,
} from './util.ts'
import { FlipperAbi } from '../abi/Flipper.ts'
import { assert } from '@std/assert'

if (Deno.env.get('START_REVIVE_DEV_NODE')) {
    const nodePath = Deno.env.get('REVIVE_DEV_NODE_PATH') ??
        `${Deno.env.get('HOME')}/polkadot-sdk/target/debug/revive-dev-node`
    console.log(`🚀 Start node ${nodePath}...`)
    killProcessOnPort(9944)
    new Deno.Command(nodePath, {
        args: [
            '--dev',
            '-l=error,evm=debug,sc_rpc_server=info,runtime::revive=debug',
        ],
        stdout: 'inherit',
        stderr: 'inherit',
    }).spawn()
}

// Run eth-rpc on 8545
if (Deno.env.get('START_ETH_RPC')) {
    const adapterPath = Deno.env.get('ETH_RPC_PATH') ??
        `${Deno.env.get('HOME')}/polkadot-sdk/target/debug/eth-rpc`
    console.log(`🚀 Start eth-rpc ${adapterPath} ...`)
    killProcessOnPort(8545)
    new Deno.Command(adapterPath, {
        args: [
            '--dev',
            '--node-rpc-url=ws://localhost:9944',
            '-l=rpc-metrics=debug,eth-rpc=debug',
        ],
        stdout: 'inherit',
        stderr: 'inherit',
    }).spawn()
}

await waitForHealth('http://localhost:8545').catch()
const env = await createEnv('eth-rpc')
const wallet = env.accountWallet

console.log('🚀 Deploy flipper...')
const hash = await wallet.deployContract({
    abi: FlipperAbi,
    bytecode: getByteCode('Flipper'),
})

const deployReceipt = await wallet.waitForTransactionReceipt({ hash })
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
        wallet.waitForTransactionReceipt({ hash }).then((receipt) => {
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
