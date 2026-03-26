/// Foreign asset ERC20 precompile integration test.
///
/// Polkadot-specific: verifies that a foreign asset created via Substrate
/// extrinsics is reachable as an ERC20 precompile through eth-rpc.
///
/// Requires the asset-hub-westend node (not revive-dev-node) and does NOT
/// run against geth.

import {
    ApiPromise,
    Keyring,
    SubmittableResult,
    WsProvider,
} from '@polkadot/api'
import type { AddressOrPair, SubmittableExtrinsic } from '@polkadot/api/types'
import { createPublicClient, decodeAbiParameters, type Hex, http } from 'viem'
import { expect } from '@std/expect'
import { sanitizeOpts as opts } from './util.ts'

interface ScaleU32 {
    toNumber(): number
}
interface ScaleOption<T> {
    isSome: boolean
    unwrap(): T
}

const SUBSTRATE_WS = `ws://localhost:${
    Deno.env.get('SUBSTRATE_RPC_PORT') ?? '9944'
}`

function assetLocation(parachainId: number) {
    return { parents: 1, interior: { x1: [{ parachain: parachainId }] } }
}

/// Connect to the substrate node and run a callback with the API and Alice signer.
function withApi(
    fn: (
        api: ApiPromise,
        alice: ReturnType<Keyring['addFromUri']>,
    ) => Promise<void>,
): () => Promise<void> {
    return async () => {
        const provider = new WsProvider(SUBSTRATE_WS)
        const api = await ApiPromise.create({ provider })
        const keyring = new Keyring({ type: 'sr25519' })
        const alice = keyring.addFromUri('//Alice')
        try {
            await fn(api, alice)
        } finally {
            await api.disconnect()
        }
    }
}

/// Submit a signed extrinsic and wait for inclusion.
function submitAndWait(
    api: ApiPromise,
    tx: SubmittableExtrinsic<'promise'>,
    signer: AddressOrPair,
): Promise<void> {
    return new Promise((resolve, reject) => {
        let unsub: (() => void) | undefined
        tx.signAndSend(
            signer,
            ({ status, dispatchError }: SubmittableResult) => {
                if (status.isInBlock || status.isFinalized) {
                    unsub?.()
                    if (dispatchError) {
                        if (dispatchError.isModule) {
                            const decoded = api.registry.findMetaError(
                                dispatchError.asModule,
                            )
                            reject(
                                new Error(
                                    `${decoded.section}.${decoded.name}: ${
                                        decoded.docs.join(' ')
                                    }`,
                                ),
                            )
                        } else {
                            reject(new Error(dispatchError.toString()))
                        }
                    } else {
                        resolve()
                    }
                }
            },
        ).then((u) => {
            unsub = u
        })
    })
}

type Signer = ReturnType<Keyring['addFromUri']>

/// Create a foreign asset via sudo (ForceOrigin required).
async function createForeignAsset(
    api: ApiPromise,
    location: ReturnType<typeof assetLocation>,
    signer: Signer,
): Promise<void> {
    await submitAndWait(
        api,
        api.tx.sudo.sudo(
            api.tx.foreignAssets.forceCreate(
                location,
                signer.address,
                false,
                1,
            ),
        ),
        signer,
    )
}

async function getForeignIdToAssetIndex(
    api: ApiPromise,
    location: Record<string, unknown>,
): Promise<number | null> {
    const val = await api.query.assetsPrecompiles.foreignAssetIdToAssetIndex(
        location,
    )
    const opt = val as unknown as ScaleOption<ScaleU32>
    return opt.isSome ? opt.unwrap().toNumber() : null
}

// ---------------------------------------------------------------------------
// ERC20 precompile works for foreign asset via eth-rpc
// ---------------------------------------------------------------------------

Deno.test(
    'polkadot-tests: ERC20 precompile works for foreign asset',
    opts,
    withApi(async (api, alice) => {
        const loc500 = assetLocation(50000)

        // Create foreign asset with metadata and mint tokens.
        await createForeignAsset(api, loc500, alice)
        await submitAndWait(
            api,
            api.tx.foreignAssets.setMetadata(
                loc500,
                'Test Token',
                'TST',
                18,
            ),
            alice,
        )
        await submitAndWait(
            api,
            api.tx.foreignAssets.mint(
                loc500,
                alice.address,
                '1000000000000000000000',
            ),
            alice,
        )

        const index = await getForeignIdToAssetIndex(api, loc500)
        expect(index).not.toBeNull()

        // Foreign assets use ForeignIdConfig<0x220>.
        // The precompile address encodes the sequential index, not the Location.
        // Layout: prefix 0x0220 at bytes 16-17, index at bytes 0-3.
        const idxHex = index!.toString(16).padStart(8, '0')
        const precompileAddr =
            `0x${idxHex}00000000000000000000000002200000` as Hex

        const rpcPort = Deno.env.get('RPC_PORT') ?? '8545'
        const publicClient = createPublicClient({
            transport: http(`http://localhost:${rpcPort}`),
        })
        const ethCall = async (selector: Hex): Promise<Hex> => {
            const { data } = await publicClient.call({
                to: precompileAddr,
                data: selector,
            })
            if (!data) {
                throw new Error(`eth_call returned no data for ${selector}`)
            }
            return data
        }

        const [nameResult, symbolResult, decimalsResult, supplyResult] =
            await Promise.all([
                ethCall('0x06fdde03'), // name()
                ethCall('0x95d89b41'), // symbol()
                ethCall('0x313ce567'), // decimals()
                ethCall('0x18160ddd'), // totalSupply()
            ])

        // Sanity-check that the precompile address is correct and returned data.
        for (
            const r of [nameResult, symbolResult, decimalsResult, supplyResult]
        ) {
            expect(r).not.toEqual('0x')
        }

        const [name] = decodeAbiParameters(
            [{ type: 'string' }],
            nameResult,
        )
        expect(name).toEqual('Test Token')

        const [symbol] = decodeAbiParameters(
            [{ type: 'string' }],
            symbolResult,
        )
        expect(symbol).toEqual('TST')

        const [decimals] = decodeAbiParameters(
            [{ type: 'uint8' }],
            decimalsResult,
        )
        expect(Number(decimals)).toEqual(18)

        const [supply] = decodeAbiParameters(
            [{ type: 'uint256' }],
            supplyResult,
        )
        expect(supply > 0n).toBe(true)
    }),
)
