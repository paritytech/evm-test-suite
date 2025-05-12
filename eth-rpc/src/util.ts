import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
    createClient,
    createPublicClient,
    createWalletClient,
    defineChain,
    formatTransactionRequest,
    type Hex,
    hexToNumber,
    http,
    parseEther,
    publicActions,
    TransactionRequest,
} from 'viem'

import { hexToBytes, concat, keccak256, pad } from 'viem/utils'
import { privateKeyToAccount, nonceManager } from 'viem/accounts'

export function getByteCode(name: string, evm: boolean = false): Hex {
    const bytecode = evm
        ? readFileSync(`evm/${name}.bin`)
        : readFileSync(`pvm/${name}.polkavm`)
    return `0x${bytecode.toString('hex')}`
}

export type JsonRpcError = {
    code: number
    message: string
    data: Hex
}

export function killProcessOnPort(port: number) {
    // Check which process is using the specified port
    const result = spawnSync('lsof', ['-ti', `:${port}`])
    const pids = result.stdout.toString().trim().split('\n').filter(Boolean)

    if (pids.length) {
        console.log(` Port ${port} is in use. Killing process...`)

        // Kill each process using the port
        for (const pid of pids) {
            process.kill(Number(pid), 'SIGKILL')
            console.log(`Killed process with PID: ${pid}`)
        }
    }
}

export let jsonRpcErrors: JsonRpcError[] = []
export type ChainEnv = Awaited<ReturnType<typeof createEnv>>
export async function createEnv(name: 'geth' | 'eth-rpc') {
    const gethPort = process.env.GETH_PORT ?? '8546'
    const ethRpcPort = process.env.ETH_RPC_PORT ?? '8545'
    const url = `http://localhost:${name == 'geth' ? gethPort : ethRpcPort}`

    let id = await (async () => {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_chainId',
                id: 1,
            }),
        })
        let { result } = await resp.json()
        return hexToNumber(result)
    })()

    const chain = defineChain({
        id,
        name,
        nativeCurrency: {
            name: 'Westie',
            symbol: 'WST',
            decimals: 18,
        },
        rpcUrls: {
            default: {
                http: [url],
            },
        },
        testnet: true,
    })

    const transport = http(url, {
        onFetchResponse: async (response) => {
            const raw = await response.clone().json()
            if (raw.error) {
                jsonRpcErrors.push(raw.error as JsonRpcError)
            }
        },
    })

    const wallet = createWalletClient({
        transport,
        chain,
    })

    const [account] = await wallet.getAddresses()
    const serverWallet = createWalletClient({
        account,
        transport,
        chain,
    }).extend(publicActions)

    const accountWallet = createWalletClient({
        account: privateKeyToAccount(
            '0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133',
            { nonceManager }
        ),
        transport,
        chain,
    }).extend(publicActions)

    // On geth let's endow the account wallet with some funds, to match the eth-rpc setup
    if (name == 'geth') {
        const endowment = parseEther('1000')
        const balance = await serverWallet.getBalance(accountWallet.account)
        if (balance < endowment / 2n) {
            const hash = await serverWallet.sendTransaction({
                account: serverWallet.account,
                to: accountWallet.account.address,
                value: endowment,
            })
            await serverWallet.waitForTransactionReceipt({ hash })
        }
    }

    const emptyWallet = createWalletClient({
        account: privateKeyToAccount(
            '0x4450c571bae82da0528ecf76fcf7079e12ecc46dc873c9cacb6db8b75ed22f41',
            { nonceManager }
        ),
        transport,
        chain,
    }).extend(publicActions)

    type TracerType = 'callTracer' | 'prestateTracer'
    type TracerConfig = {
        callTracer: { withLog?: boolean; onlyTopCall?: boolean }
        prestateTracer: {
            diffMode?: boolean
            disableCode?: boolean
            disableStorage?: boolean
        }
    }

    const publicClient = createPublicClient({ chain, transport })

    const debugClient = createClient({
        chain,
        transport,
    }).extend((client) => ({
        async traceTransaction<Tracer extends TracerType>(
            txHash: Hex,
            tracer: Tracer,
            tracerConfig?: TracerConfig[Tracer]
        ) {
            return client.request({
                method: 'debug_traceTransaction' as any,
                params: [txHash, { tracer, tracerConfig } as any],
            })
        },
        async traceBlock<Tracer extends TracerType>(
            blockNumber: bigint,
            tracer: Tracer,
            tracerConfig?: TracerConfig[Tracer]
        ) {
            return client.request({
                method: 'debug_traceBlockByNumber' as any,
                params: [
                    `0x${blockNumber.toString(16)}`,
                    { tracer, tracerConfig } as any,
                ],
            })
        },

        async traceCall<Tracer extends TracerType>(
            args: TransactionRequest,
            tracer: Tracer,
            tracerConfig?: TracerConfig[Tracer]
        ) {
            return client.request({
                method: 'debug_traceCall' as any,
                params: [
                    formatTransactionRequest(args),
                    'latest',
                    { tracer, tracerConfig } as any,
                ],
            })
        },
    }))

    return {
        chain,
        debugClient,
        publicClient,
        emptyWallet,
        serverWallet,
        accountWallet,
        evm: name == 'geth',
    }
}

export type Env = Awaited<ReturnType<typeof createEnv>>

export function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export function timeout(ms: number) {
    return new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('timeout hit')), ms)
    )
}

// wait for http request to return 200
export function waitForHealth(url: string) {
    return new Promise<void>((resolve, reject) => {
        const start = Date.now()
        const interval = setInterval(async () => {
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_syncing',
                        params: [],
                        id: 1,
                    }),
                })

                if (res.status !== 200) {
                    return
                }

                clearInterval(interval)
                resolve()
            } catch (_err) {
                const elapsed = Date.now() - start
                if (elapsed > 30_000) {
                    clearInterval(interval)
                    reject(new Error('hit timeout'))
                }
            }
        }, 1000)
    })
}

export function visit(
    obj: any,
    callback: (key: string, value: any) => [string, any]
): any {
    if (Array.isArray(obj)) {
        return obj.map((item) => visit(item, callback))
    } else if (typeof obj === 'object' && obj !== null) {
        return Object.keys(obj).reduce((acc, key) => {
            const [mappedKey, mappedValue] = callback(key, obj[key])
            if (mappedKey in acc) {
                throw new Error(`visit(): duplicate mapped key “${mappedKey}”`)
            }
            acc[mappedKey] = visit(mappedValue, callback)
            return acc
        }, {} as any)
    } else {
        return obj
    }
}

export type Visitor = Parameters<typeof visit>[1]

export function memoized<T>(transact: () => Promise<T>) {
    return (() => {
        let result: T | null = null
        async function getResult() {
            if (result) {
                return result
            }
            result = await transact()
            return result
        }

        return getResult
    })()
}

export function memoizedTx(env: ChainEnv, transact: () => Promise<Hex>) {
    return memoized(async () => {
        const hash = await transact()
        return await env.serverWallet.waitForTransactionReceipt({
            hash,
        })
    })
}

export function memoizedDeploy(env: ChainEnv, transact: () => Promise<Hex>) {
    const getReceipt = memoizedTx(env, transact)
    return async () => {
        const receipt = await getReceipt()
        return receipt.contractAddress!
    }
}

export function fixture(name: string) {
    return JSON.parse(fs.readFileSync(`./src/fixtures/${name}.json`, 'utf-8'))
}

export function writeFixture(name: string, data: any) {
    const json = JSON.stringify(data, null, 2)
    fs.writeFileSync(`./src/fixtures/${name}.json`, json, 'utf8')
}

export async function computeMappingSlot(addressKey: Hex, slotIndex: number) {
    const keyBytes = pad(hexToBytes(addressKey), { size: 32 })
    const slotBytes = pad(hexToBytes(`0x${slotIndex.toString(16)}`), {
        size: 32,
    })

    const unhashedKey = concat([keyBytes, slotBytes])
    const storageSlot = keccak256(unhashedKey)
    return storageSlot
}

// run it
