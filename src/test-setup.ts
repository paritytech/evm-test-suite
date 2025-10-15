import { killProcessOnPort, waitForHealth } from './util.ts'

export type Env = 'geth' | 'eth-rpc'

let processes: Deno.ChildProcess[] = []
let envs: Env[] = []

export async function setupTests(): Promise<Env[]> {
    let useGeth = !!Deno.env.get('USE_GETH')
    let useEthRpc = !!Deno.env.get('USE_ETH_RPC')

    if (Deno.env.get('START_GETH')) {
        useGeth = true
        const geth = Deno.env.get('GETH_BIN') ?? 'geth'
        const gethArgs = [
            '--http',
            '--http.api',
            'web3,eth,debug,personal,net',
            '--http.port',
            '8546',
            '--dev',
            '--verbosity',
            '0',
        ]

        await killProcessOnPort(8546)
        console.log('🚀 Start geth...')
        const gethProcess = new Deno.Command(geth, {
            args: gethArgs,
            stdout: 'null',
            stderr: 'null',
        }).spawn()
        processes.push(gethProcess)
        await waitForHealth('http://localhost:8546').catch(() => {})
    }

    if (Deno.env.get('START_REVIVE_DEV_NODE')) {
        const devNodeArgs = [
            '--dev',
            '-l=error,evm=debug,sc_rpc_server=info,runtime::revive=debug',
        ]

        await killProcessOnPort(9944)
        const nodePath = Deno.env.get('REVIVE_DEV_NODE_PATH') ??
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
        useEthRpc = true

        // Run eth-rpc on 8545
        const ethRpcArgs = [
            '--dev',
            '--node-rpc-url=ws://localhost:9944',
            '-l=rpc-metrics=debug,eth-rpc=debug',
        ]

        await killProcessOnPort(8545)
        const adapterPath = Deno.env.get('ETH_RPC_PATH') ??
            `${Deno.env.get('HOME')}/polkadot-sdk/target/debug/eth-rpc`
        console.log('🚀 Start eth-rpc ...')
        const ethRpcProcess = new Deno.Command(adapterPath, {
            args: ethRpcArgs,
            stdout: 'null',
            stderr: 'null',
        }).spawn()
        processes.push(ethRpcProcess)
        await waitForHealth('http://localhost:8545').catch(() => {})
    }

    envs = [
        ...(useGeth ? ['geth' as const] : []),
        ...(useEthRpc ? ['eth-rpc' as const] : []),
    ]

    if (envs.length === 0) {
        throw new Error('No environment started. Set USE_GETH or USE_ETH_RPC')
    }

    return envs
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

export function getEnvs(): Env[] {
    return envs
}
