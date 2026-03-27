import { hexToBytes, toHex } from 'viem/utils'
import { getRpcUrl, killProcessOnPort, waitForHealth } from './util.ts'

let processes: Deno.ChildProcess[] = []
let tmpDirs: string[] = []
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

    if (Deno.env.get('START_ASSET_HUB_WESTEND')) {
        const sdkDir = Deno.env.get('POLKADOT_SDK_DIR') ??
            `${Deno.env.get('HOME')}/polkadot-sdk`
        const omniNode = Deno.env.get('OMNI_NODE_PATH') ??
            `${sdkDir}/target/release/polkadot-omni-node`
        const useLiveRuntime = !!Deno.env.get('USE_LIVE_RUNTIME')
        const chainSpec = await buildAssetHubWestendSpec(
            sdkDir,
            omniNode,
            useLiveRuntime,
        )

        const nodeArgs = [
            '--dev',
            `--chain=${chainSpec}`,
            '--dev-block-time=3000',
            '--tmp',
            '--rpc-port=9944',
            '--rpc-cors=all',
            '--no-prometheus',
            '-l=error,sc_rpc_server=info,runtime::revive=debug',
        ]

        await killProcessOnPort(9944)
        console.log('🚀 Start asset-hub-westend node ...')
        const nodeProcess = new Deno.Command(omniNode, {
            args: nodeArgs,
            stdout: 'null',
            stderr: 'inherit',
        }).spawn()
        processes.push(nodeProcess)
        await waitForHealth('http://localhost:9944')
    } else if (Deno.env.get('START_REVIVE_DEV_NODE')) {
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
    await detectAndSetPlatform(getRpcUrl())
}

export function cleanupTests() {
    if (processes.length === 0 && tmpDirs.length === 0) {
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
    for (const dir of tmpDirs) {
        try {
            Deno.removeSync(dir, { recursive: true })
        } catch {
            // Directory might already be gone
        }
    }
    processes = []
    tmpDirs = []
}

// ---------------------------------------------------------------------------
// Asset-hub-westend chain spec generation
// ---------------------------------------------------------------------------
// Parachain runtimes need two genesis storage keys injected so the scheduler
// doesn't crawl from relay block 1 to ~295M on every block.
// See: https://github.com/paritytech/node-env/blob/main/lib/chain_spec.ts

// Pre-computed twox128 storage keys (static, never change):
//   twox128("Scheduler") ++ twox128("IncompleteSince")
const SCHEDULER_INCOMPLETE_SINCE =
    '0x3db7a24cfdc9de785974746c14a99df9f7be9b0bf16f84e559a58101c891d523'
//   twox128("ParachainSystem") ++ twox128("LastRelayChainBlockNumber")
// TODO: no longer necessary if this issue gets fixed: https://github.com/paritytech/polkadot-sdk/pull/10807#issuecomment-3966008358
const PARACHAIN_LAST_RELAY_BLOCK =
    '0x45323df7cc47150b3930e2666b0aa313a2bca190d36bd834cc73a38fc213ecbd'

function u32ToLeHex(n: number): string {
    const buf = new Uint8Array(4)
    new DataView(buf.buffer).setUint32(0, n, true)
    return '0x' + [...buf].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function runCommand(
    cmd: string[],
): Promise<string> {
    const proc = new Deno.Command(cmd[0], {
        args: cmd.slice(1),
        stdout: 'piped',
        stderr: 'piped',
    })
    const output = await proc.output()
    if (!output.success) {
        const stderr = new TextDecoder().decode(output.stderr)
        throw new Error(`Command failed: ${cmd.join(' ')}\n${stderr}`)
    }
    return new TextDecoder().decode(output.stdout)
}

async function downloadLiveRuntime(
    tmpDir: string,
    rpcUrl: string,
): Promise<string> {
    const codeStorageKey = toHex(':code')
    console.log(`📦 Downloading runtime from ${rpcUrl} ...`)
    const resp = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(120_000 /* 2 min */),
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'state_getStorage',
            params: [codeStorageKey],
            id: 1,
        }),
    })
    if (!resp.ok) {
        throw new Error(
            `RPC request failed: ${resp.status} ${resp.statusText}`,
        )
    }
    const { result } = (await resp.json()) as { result: string }
    if (!result || result === '0x') {
        throw new Error('Failed to fetch runtime wasm from live network')
    }
    const runtimeCode = hexToBytes(result as `0x${string}`)
    const path = `${tmpDir}/westend-asset-hub-runtime.wasm`
    await Deno.writeFile(path, runtimeCode)
    console.log(
        `📦 Runtime downloaded (${
            (runtimeCode.length / 1024 / 1024).toFixed(1)
        } MB)`,
    )
    return path
}

async function buildAssetHubWestendSpec(
    sdkDir: string,
    omniNode: string,
    useLiveRuntime = false,
): Promise<string> {
    const tmpDir = await Deno.makeTempDir({ prefix: 'ah-westend-' })
    tmpDirs.push(tmpDir)
    const runtime = useLiveRuntime
        ? await downloadLiveRuntime(
            tmpDir,
            Deno.env.get('WESTEND_RPC_URL') ??
                'https://westend-asset-hub-rpc.polkadot.io',
        )
        : `${sdkDir}/target/release/wbuild/asset-hub-westend-runtime/asset_hub_westend_runtime.compact.compressed.wasm`
    const basePath = `${tmpDir}/ah-westend-base.json`
    const rawPath = `${tmpDir}/ah-westend-raw.json`

    // Step 1: Generate base chain spec (writes to file via --chain-spec-path)
    console.log('📋 Generating asset-hub-westend chain spec ...')
    await runCommand([
        omniNode,
        'chain-spec-builder',
        '--chain-spec-path',
        basePath,
        'create',
        '--relay-chain',
        'dontcare',
        '--para-id',
        '1000',
        '--runtime',
        runtime,
        'named-preset',
        'development',
    ])

    // Step 1b: Patch the base spec to set Alice as sudo key
    const baseSpec = JSON.parse(await Deno.readTextFile(basePath))
    const ALICE_SS58 = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
    baseSpec.genesis ??= {}
    baseSpec.genesis.runtimeGenesis ??= {}
    baseSpec.genesis.runtimeGenesis.patch ??= {}
    baseSpec.genesis.runtimeGenesis.patch.sudo = { key: ALICE_SS58 }
    // Fund alith (0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac) so eth_accounts[0] has balance.
    const ALITH_SS58 = '5HYRCKHYJN9z5xUtfFkyMj4JUhsAwWyvuU8vKB1FcnYTf9ZQ'
    const balances = baseSpec.genesis.runtimeGenesis.patch.balances?.balances ??
        []
    balances.push([ALITH_SS58, Number.MAX_SAFE_INTEGER])
    baseSpec.genesis.runtimeGenesis.patch.balances = {
        ...baseSpec.genesis.runtimeGenesis.patch.balances,
        balances,
    }
    await Deno.writeTextFile(basePath, JSON.stringify(baseSpec, null, 2))

    // Step 2: Convert to raw format
    const rawSpec = await runCommand([
        omniNode,
        'build-spec',
        '--raw',
        '--chain',
        basePath,
    ])

    // Step 3: Inject scheduler keys so the parachain doesn't stall
    const spec = JSON.parse(rawSpec)
    const RELAY_BLOCK_TIME_MS = 6000
    const SAFETY_OFFSET_MS = 2 * 3600_000 // Start 2h behind "now" to avoid future-block issues
    const relayBlock = Math.floor(
        (Date.now() - SAFETY_OFFSET_MS) / RELAY_BLOCK_TIME_MS,
    )
    const value = u32ToLeHex(relayBlock)
    spec.genesis.raw.top[SCHEDULER_INCOMPLETE_SINCE] = value
    spec.genesis.raw.top[PARACHAIN_LAST_RELAY_BLOCK] = value

    await Deno.writeTextFile(rawPath, JSON.stringify(spec))
    console.log('📋 Chain spec ready')
    return rawPath
}
