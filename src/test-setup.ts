import { killProcessOnPort, waitForHealth } from './util.ts'

let processes: Deno.ChildProcess[] = []
let setupComplete = false

async function detectAndSetPlatform(url: string) {
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'web3_clientVersion',
                id: 1,
            }),
        })
        const { result } = (await resp.json()) as { result: string }
        let platform = result.toLowerCase().split('/')[0]
        if (Deno.env.get('USE_BYTECODE') === 'pvm') {
            platform += '-pvm'
        }
        Deno.env.set('PLATFORM', platform)
    } catch (_) {
        throw new Error(
            'No platform detected. Start the chain manually or use START_GETH or START_REVIVE_DEV_NODE and START_ETH_RPC to start the chain from the test runner.',
        )
    }
}

export async function setupTests() {
    // Only run setup once, even if imported by multiple test files
    if (setupComplete) {
        return
    }
    setupComplete = true
    if (Deno.env.get('START_GETH')) {
        const geth = Deno.env.get('GETH_PATH') ?? 'geth'
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

        const versionOutput = await new Deno.Command(geth, {
            args: ['version'],
            stdout: 'piped',
            stderr: 'piped',
        }).output()
        const version = new TextDecoder().decode(versionOutput.stdout)
        console.log(version)
        console.log('🚀 Start geth...')
        const gethProcess = new Deno.Command(geth, {
            args: gethArgs,
            stdout: 'null',
            stderr: 'null',
        }).spawn()
        processes.push(gethProcess)
        await waitForHealth('http://localhost:8545').catch(() => {})

        if (!Deno.env.has('USE_BYTECODE')) {
            Deno.env.set('USE_BYTECODE', 'evm')
        }
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
        // Run eth-rpc on 8545
        const ethRpcArgs = [
            '--dev',
            '--node-rpc-url=ws://localhost:9944',
            '-l=rpc-metrics=debug,eth-rpc=debug',
        ]

        await killProcessOnPort(8545)
        const ethRpcPath = Deno.env.get('ETH_RPC_PATH') ??
            `${Deno.env.get('HOME')}/polkadot-sdk/target/debug/eth-rpc`
        console.log('🚀 Start eth-rpc ...')
        const ethRpcProcess = new Deno.Command(ethRpcPath, {
            args: ethRpcArgs,
            stdout: 'null',
            stderr: 'null',
        }).spawn()
        processes.push(ethRpcProcess)
        await waitForHealth('http://localhost:8545').catch(() => {})

        if (!Deno.env.has('USE_BYTECODE')) {
            Deno.env.set('USE_BYTECODE', 'evm')
        }
    }

    // Detect and set the PLATFORM variable
    const port = Deno.env.get('RPC_PORT') ?? '8545'
    const url = `http://localhost:${port}`
    await detectAndSetPlatform(url)
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
