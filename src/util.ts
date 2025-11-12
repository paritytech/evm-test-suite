/// <reference lib="deno.ns" />
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
    type TransactionReceipt,
    TransactionRequest,
} from 'viem'

import { concat, hexToBytes, keccak256, pad } from 'viem/utils'
import { nonceManager, privateKeyToAccount } from 'viem/accounts'
import { encodeHex } from '@std/encoding/hex'

export const sanitizeOpts = {
    sanitizeResources: false,
    sanitizeOps: false,
    sanitizeExit: false,
}

export function getByteCode(name: string, evm: boolean): Hex {
    const bytecode = evm
        ? Deno.readFileSync(`codegen/evm/${name}.bin`)
        : Deno.readFileSync(`codegen/pvm/${name}.polkavm`)
    return `0x${encodeHex(bytecode)}` as Hex
}

export function getRuntimeByteCode(name: string, evm: boolean): Hex {
    const bytecode = evm
        ? Deno.readFileSync(`codegen/evm/${name}.runtime.bin`)
        : Deno.readFileSync(`codegen/pvm/${name}.polkavm`)
    return `0x${encodeHex(bytecode)}` as Hex
}

export type JsonRpcError = {
    code: number
    message: string
    data: Hex
}

export async function killProcessOnPort(port: number) {
    // Check which process is using the specified port
    const command = new Deno.Command('lsof', {
        args: ['-ti', `:${port}`],
        stdout: 'piped',
        stderr: 'piped',
    })

    try {
        const { stdout } = await command.output()
        const pids = new TextDecoder()
            .decode(stdout)
            .trim()
            .split('\n')
            .filter(Boolean)

        if (pids.length) {
            console.log(` Port ${port} is in use. Killing process...`)

            // Kill each process using the port
            for (const pid of pids) {
                try {
                    Deno.kill(Number(pid), 'SIGKILL')
                    console.log(`Killed process with PID: ${pid}`)
                } catch {
                    // Process might already be dead
                }
            }
        }
    } catch {
        // lsof might fail if port is not in use
    }
}

export type EnvName = 'geth' | 'revive-pvm' | 'revive-evm'

function getEnvName(): EnvName {
    const platform = Deno.env.get('PLATFORM')

    if (!platform || !['geth', 'revive-evm', 'revive-pvm'].includes(platform)) {
        throw new Error(
            'No platform specified. PLATFORM should be set to one of: geth, revive-evm, revive-pvm',
        )
    }

    return platform as EnvName
}

export const jsonRpcErrors: JsonRpcError[] = []

export type Env = Awaited<ReturnType<typeof getEnv>>
export async function getEnv() {
    const port = Deno.env.get('RPC_PORT') ?? '8545'
    const url = `http://localhost:${port}`
    const name = getEnvName()

    const id = await (async (): Promise<number> => {
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
        const { result } = (await resp.json()) as { result: Hex }
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

    const waitForTransactionReceiptExtension = (client: {
        getTransactionReceipt: (args: {
            hash: Hex
        }) => Promise<TransactionReceipt>
    }) => ({
        async waitForTransactionReceipt(
            hash: Hex,
            pollingInterval = 10,
            timeout = 6000,
        ): Promise<TransactionReceipt> {
            const startTime = Date.now()
            while (true) {
                try {
                    const receipt = await client.getTransactionReceipt({ hash })
                    if (receipt) return receipt
                } catch (error) {
                    const errorStr = String(error)
                    if (
                        !errorStr.includes(
                            'transaction indexing is in progress',
                        ) &&
                        !errorStr.includes('transaction not found') &&
                        !errorStr.includes('TransactionReceiptNotFoundError')
                    ) {
                        // Unexpected error, rethrow it
                        throw error
                    }
                }
                if (Date.now() - startTime > timeout) {
                    throw new Error(
                        `Transaction receipt timeout after ${timeout}ms for hash ${hash}`,
                    )
                }
                await new Promise((resolve) =>
                    setTimeout(resolve, pollingInterval)
                )
            }
        },
    })

    const wallet = createWalletClient({
        transport,
        chain,
        cacheTime: 0,
    })

    const [account] = await wallet.getAddresses()
    const serverWallet = createWalletClient({
        account,
        transport,
        chain,
        cacheTime: 0,
    })
        .extend(publicActions)
        .extend(waitForTransactionReceiptExtension)

    const accountWallet = createWalletClient({
        account: privateKeyToAccount(
            '0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133',
            { nonceManager },
        ),
        transport,
        chain,
        cacheTime: 0,
    })
        .extend(publicActions)
        .extend(waitForTransactionReceiptExtension)

    // On geth let's endow the account wallet with some funds, to match the eth-rpc setup
    if (name === 'geth') {
        const endowment = parseEther('1000')
        const balance = await serverWallet.getBalance(accountWallet.account)
        if (balance < endowment / 2n) {
            const hash = await serverWallet.sendTransaction({
                account: serverWallet.account,
                to: accountWallet.account.address,
                value: endowment,
            })
            await serverWallet.waitForTransactionReceipt(hash)
        }
    }

    const emptyWallet = createWalletClient({
        account: privateKeyToAccount(
            '0x4450c571bae82da0528ecf76fcf7079e12ecc46dc873c9cacb6db8b75ed22f41',
            { nonceManager },
        ),
        transport,
        chain,
        cacheTime: 0,
    })
        .extend(publicActions)
        .extend(waitForTransactionReceiptExtension)

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
        traceTransaction<Tracer extends TracerType>(
            txHash: Hex,
            tracer: Tracer,
            tracerConfig?: TracerConfig[Tracer],
        ): Promise<unknown> {
            return client.request({
                method: 'debug_traceTransaction' as 'eth_chainId',
                params: [txHash, { tracer, tracerConfig }] as never,
            })
        },
        traceBlock<Tracer extends TracerType>(
            blockNumber: bigint,
            tracer: Tracer,
            tracerConfig?: TracerConfig[Tracer],
        ): Promise<unknown> {
            return client.request({
                method: 'debug_traceBlockByNumber' as 'eth_chainId',
                params: [
                    `0x${blockNumber.toString(16)}`,
                    { tracer, tracerConfig },
                ] as never,
            })
        },

        traceCall<Tracer extends TracerType>(
            args: TransactionRequest,
            tracer: Tracer,
            tracerConfig: TracerConfig[Tracer],
            blockOrTag: 'latest' | Hex = 'latest',
        ): Promise<unknown> {
            return client.request({
                method: 'debug_traceCall' as 'eth_chainId',
                params: [
                    formatTransactionRequest(args),
                    blockOrTag,
                    { tracer, tracerConfig },
                ] as never,
            })
        },

        ...waitForTransactionReceiptExtension(publicClient),
    }))

    const useByteCode = Deno.env.get('USE_BYTECODE') ?? 'evm'
    return {
        chain,
        debugClient,
        publicClient,
        emptyWallet,
        serverWallet,
        accountWallet,
        evm: useByteCode === 'evm',
        name,
    }
}

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
                if (elapsed > 60_000) {
                    clearInterval(interval)
                    reject(new Error('hit timeout'))
                }
            }
        }, 1000)
    })
}

export function visit(
    obj: unknown,
    callback: (
        key: string,
        value: unknown,
        parent: unknown,
    ) => [string, unknown] | null,
): unknown {
    if (Array.isArray(obj)) {
        return obj.map((item) => visit(item, callback))
    } else if (typeof obj === 'object' && obj !== null) {
        return Object.keys(obj).reduce((acc, key) => {
            const mapped = callback(
                key,
                (obj as Record<string, unknown>)[key],
                obj,
            )
            if (!mapped) {
                return acc
            }
            const [mappedKey, mappedValue] = mapped
            if (mappedKey in acc) {
                throw new Error(`visit(): duplicate mapped key "${mappedKey}"`)
            }
            acc[mappedKey] = visit(mappedValue, callback)
            return acc
        }, {} as Record<string, unknown>)
    } else {
        return obj
    }
}

export type Visitor = Parameters<typeof visit>[1]

export function memoized<T>(transact: () => Promise<T>): () => Promise<T> {
    let result: T | null = null
    return async function getResult(): Promise<T> {
        if (result) {
            return result
        }
        result = await transact()
        return result
    }
}

export function memoizedTx(env: Env, transact: () => Promise<Hex>) {
    return memoized(async () => {
        const hash = await transact()
        return await env.serverWallet.waitForTransactionReceipt(hash)
    })
}

export function memoizedDeploy(env: Env, transact: () => Promise<Hex>) {
    const getReceipt = memoizedTx(env, transact)
    return async () => {
        const receipt = await getReceipt()
        return receipt.contractAddress!
    }
}

export function computeMappingSlot(addressKey: Hex, slotIndex: number) {
    const keyBytes = pad(hexToBytes(addressKey), { size: 32 })
    const slotBytes = pad(hexToBytes(`0x${slotIndex.toString(16)}`), {
        size: 32,
    })

    const unhashedKey = concat([keyBytes, slotBytes])
    const storageSlot = keccak256(unhashedKey)
    return storageSlot
}
