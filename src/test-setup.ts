import { killProcessOnPort, waitForHealth } from './util.ts'

let processes: Deno.ChildProcess[] = []
let setupComplete = false

export const sanitizeOpts = {
    sanitizeResources: false,
    sanitizeOps: false,
    sanitizeExit: false,
}

export async function setupTests() {
    // Only run setup once, even if imported by multiple test files
    if (setupComplete) {
        return
    }
    setupComplete = true
    if (Deno.env.get('START_GETH')) {
        const geth = Deno.env.get('GETH_BIN') ?? 'geth'
        const gethArgs = [
            '--http',
            '--http.api',
            'web3,eth,debug,personal,net',
            '--http.port',
            '8545',
            '--dev',
            '--verbosity',
            '0',
        ]

        await killProcessOnPort(8545)
        console.log('🚀 Start geth...')
        const gethProcess = new Deno.Command(geth, {
            args: gethArgs,
            stdout: 'null',
            stderr: 'null',
        }).spawn()
        processes.push(gethProcess)
        await waitForHealth('http://localhost:8545').catch(() => {})
        Deno.env.set('USE_GETH', 'true')
    }

    if (Deno.env.get('START_REVIVE_DEV_NODE')) {
        const devNodeArgs = [
            '--dev',
            '-l=error,evm=debug,sc_rpc_server=info,runtime::revive=debug',
        ]

        await killProcessOnPort(9944)
        const nodePath =
            Deno.env.get('REVIVE_DEV_NODE_PATH') ??
            `${Deno.env.get('HOME')}/polkadot-sdk/target/debug/revive-dev-node`
        console.log('🚀 Start dev-node ...')
        const devNodeProcess = new Deno.Command(nodePath, {
            args: devNodeArgs,
            stdout: 'null',
            stderr: 'null',
        }).spawn()
        processes.push(devNodeProcess)
    }

    if (Deno.env.get('START_ETH_RPC')) {
        // Run eth-rpc on 8545
        const ethRpcArgs = [
            '--dev',
            '--node-rpc-url=ws://localhost:9944',
            '-l=rpc-metrics=debug,eth-rpc=debug',
        ]

        await killProcessOnPort(8545)
        const ethRpcPath =
            Deno.env.get('ETH_RPC_PATH') ??
            `${Deno.env.get('HOME')}/polkadot-sdk/target/debug/eth-rpc`
        console.log('🚀 Start eth-rpc ...')
        const ethRpcProcess = new Deno.Command(ethRpcPath, {
            args: ethRpcArgs,
            stdout: 'null',
            stderr: 'null',
        }).spawn()
        processes.push(ethRpcProcess)
        await waitForHealth('http://localhost:8545').catch(() => {})

        if (!Deno.env.has('USE_REVIVE')) {
            Deno.env.set('USE_REVIVE', 'evm')
        }
    }
}

export function cleanupTests() {
    if (processes.length === 0) {
        return
    }
    console.log('🔌 Shutting down servers...')
    for (const proc of processes) {
        try {
            proc.kill('SIGTERM')
        } catch {
            // Process might already be dead
        }
    }
    processes = []
}
