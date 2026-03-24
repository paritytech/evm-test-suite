/// ForeignAssetId CallbackHandle integration tests.
///
/// These are Polkadot-specific: they test that foreign asset extrinsics
/// (force_create, start_destroy/finish_destroy) trigger the
/// ForeignAssetId callback, and that the ERC20 precompile is reachable
/// at the derived foreign asset address.
///
/// They require the asset-hub-westend node (not revive-dev-node) and do NOT
/// run against geth.

import {
    ApiPromise,
    Keyring,
    SubmittableResult,
    WsProvider,
} from '@polkadot/api'
import type { AddressOrPair, SubmittableExtrinsic } from '@polkadot/api/types'
import { decodeAbiParameters, type Hex } from 'viem'
import { expect } from '@std/expect'
import { sanitizeOpts as opts } from './util.ts'

// Minimal type aliases for unaugmented storage return values.
// @polkadot/types is a transitive dep and not in the import map,
// so we define the shapes we need inline.
interface ScaleU32 {
    toNumber(): number
}
interface ScaleCodec {
    toJSON(): unknown
}
interface ScaleOption<T> {
    isSome: boolean
    unwrap(): T
}

const SUBSTRATE_WS = `ws://localhost:${
    Deno.env.get('SUBSTRATE_RPC_PORT') ?? '9944'
}`

// XCM Location representing a foreign asset.
// We use { parents: 1, interior: { X1: [{ Parachain: N }] } } as a simple
// unique location for each test asset.
function assetLocation(parachainId: number) {
    return { parents: 1, interior: { X1: [{ Parachain: parachainId }] } }
}

// .toJSON() on SCALE-encoded XCM Locations lowercases keys (x1, parachain).
// This returns the expected JSON form for use with toEqual().
function assetLocationJson(parachainId: number) {
    return { parents: 1, interior: { x1: [{ parachain: parachainId }] } }
}

/// Connect to the substrate node and run a callback with the API and Alice signer.
async function withApi(
    fn: (
        api: ApiPromise,
        alice: ReturnType<Keyring['addFromUri']>,
    ) => Promise<void>,
): Promise<void> {
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

async function getNextAssetIndex(api: ApiPromise): Promise<number> {
    const val = await api.query.assetsPrecompiles.nextAssetIndex()
    return (val as unknown as ScaleU32).toNumber()
}

async function getAssetIndexToForeignId(
    api: ApiPromise,
    index: number,
): Promise<unknown> {
    const val = await api.query.assetsPrecompiles.assetIndexToForeignAssetId(
        index,
    )
    const opt = val as unknown as ScaleOption<ScaleCodec>
    return opt.isSome ? opt.unwrap().toJSON() : null
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
// Test 1: Foreign asset creation populates foreign asset mapping
// ---------------------------------------------------------------------------

Deno.test(
    'polkadot-tests: create populates foreign asset mapping',
    opts,
    () =>
        withApi(async (api, alice) => {
            const nextBefore = await getNextAssetIndex(api)

            const loc42 = assetLocation(4200)
            // Foreign assets require ForceOrigin (root) to create.
            await submitAndWait(
                api,
                api.tx.sudo.sudo(
                    api.tx.foreignAssets.forceCreate(
                        loc42,
                        alice.address,
                        false,
                        1,
                    ),
                ),
                alice,
            )

            expect(await getNextAssetIndex(api)).toEqual(nextBefore + 1)
            const idx42 = await getForeignIdToAssetIndex(api, loc42)
            expect(idx42).not.toBeNull()
            expect(idx42).toEqual(nextBefore)

            // Reverse lookup — verify it points back to the correct location.
            const stored = await getAssetIndexToForeignId(api, idx42!)
            expect(stored).toEqual(assetLocationJson(4200))

            // Create another — verify sequential indexing.
            const loc100 = assetLocation(10000)
            await submitAndWait(
                api,
                api.tx.sudo.sudo(
                    api.tx.foreignAssets.forceCreate(
                        loc100,
                        alice.address,
                        false,
                        1,
                    ),
                ),
                alice,
            )

            expect(await getNextAssetIndex(api)).toEqual(nextBefore + 2)
            const idx100 = await getForeignIdToAssetIndex(api, loc100)
            expect(idx100).toEqual(nextBefore + 1)
        }),
)

// ---------------------------------------------------------------------------
// Test 2: Asset destruction cleans up mapping
// ---------------------------------------------------------------------------

Deno.test(
    'polkadot-tests: destroy cleans up foreign asset mapping',
    opts,
    () =>
        withApi(async (api, alice) => {
            const loc200 = assetLocation(20000)
            const loc201 = assetLocation(20100)

            await submitAndWait(
                api,
                api.tx.sudo.sudo(
                    api.tx.foreignAssets.forceCreate(
                        loc200,
                        alice.address,
                        false,
                        1,
                    ),
                ),
                alice,
            )
            await submitAndWait(
                api,
                api.tx.sudo.sudo(
                    api.tx.foreignAssets.forceCreate(
                        loc201,
                        alice.address,
                        false,
                        1,
                    ),
                ),
                alice,
            )

            const idx200 = await getForeignIdToAssetIndex(api, loc200)
            expect(idx200).not.toBeNull()
            const idx201 = await getForeignIdToAssetIndex(api, loc201)
            expect(idx201).not.toBeNull()

            // Destroy asset loc200.
            await submitAndWait(
                api,
                api.tx.foreignAssets.startDestroy(loc200),
                alice,
            )
            await submitAndWait(
                api,
                api.tx.foreignAssets.finishDestroy(loc200),
                alice,
            )

            // Mapping for loc200 should be gone.
            expect(await getAssetIndexToForeignId(api, idx200!)).toBeNull()
            expect(await getForeignIdToAssetIndex(api, loc200)).toBeNull()

            // NextAssetIndex should NOT be decremented.
            const nextIdx = await getNextAssetIndex(api)
            expect(nextIdx).toBeGreaterThan(idx201!)

            // loc201 should be unaffected.
            expect(
                await getAssetIndexToForeignId(api, idx201!),
            ).toEqual(assetLocationJson(20100))
        }),
)

// ---------------------------------------------------------------------------
// Test 3: Re-created asset gets a new index
// ---------------------------------------------------------------------------

Deno.test(
    'polkadot-tests: re-created asset gets new index',
    opts,
    () =>
        withApi(async (api, alice) => {
            const loc300 = assetLocation(30000)

            await submitAndWait(
                api,
                api.tx.sudo.sudo(
                    api.tx.foreignAssets.forceCreate(
                        loc300,
                        alice.address,
                        false,
                        1,
                    ),
                ),
                alice,
            )
            const oldIndex = await getForeignIdToAssetIndex(api, loc300)
            expect(oldIndex).not.toBeNull()

            // Destroy it.
            await submitAndWait(
                api,
                api.tx.foreignAssets.startDestroy(loc300),
                alice,
            )
            await submitAndWait(
                api,
                api.tx.foreignAssets.finishDestroy(loc300),
                alice,
            )
            expect(await getForeignIdToAssetIndex(api, loc300)).toBeNull()

            // Re-create — should get a new, higher index.
            await submitAndWait(
                api,
                api.tx.sudo.sudo(
                    api.tx.foreignAssets.forceCreate(
                        loc300,
                        alice.address,
                        false,
                        1,
                    ),
                ),
                alice,
            )
            const newIndex = await getForeignIdToAssetIndex(api, loc300)
            expect(newIndex).not.toBeNull()
            expect(newIndex).not.toEqual(oldIndex)
            expect(newIndex!).toBeGreaterThan(oldIndex!)

            // Reverse lookup works.
            expect(
                await getAssetIndexToForeignId(api, newIndex!),
            ).toEqual(assetLocationJson(30000))
        }),
)

// ---------------------------------------------------------------------------
// Test 4: force_create triggers callback (delta pattern)
// ---------------------------------------------------------------------------

Deno.test(
    'polkadot-tests: force_create triggers callback',
    opts,
    () =>
        withApi(async (api, alice) => {
            const nextBefore = await getNextAssetIndex(api)

            const loc999 = assetLocation(99900)
            await submitAndWait(
                api,
                api.tx.sudo.sudo(
                    api.tx.foreignAssets.forceCreate(
                        loc999,
                        alice.address,
                        false,
                        1,
                    ),
                ),
                alice,
            )

            const nextAfter = await getNextAssetIndex(api)
            expect(nextAfter).toEqual(nextBefore + 1)

            const mapping = await getForeignIdToAssetIndex(api, loc999)
            expect(mapping).not.toBeNull()
            expect(
                await getAssetIndexToForeignId(api, mapping!),
            ).toEqual(assetLocationJson(99900))
        }),
)

// ---------------------------------------------------------------------------
// Test 5: destroy cleans up mapping (force_create + destroy)
// ---------------------------------------------------------------------------

Deno.test(
    'polkadot-tests: destroy after force_create cleans up mapping',
    opts,
    () =>
        withApi(async (api, alice) => {
            const loc998 = assetLocation(99800)

            await submitAndWait(
                api,
                api.tx.sudo.sudo(
                    api.tx.foreignAssets.forceCreate(
                        loc998,
                        alice.address,
                        false,
                        1,
                    ),
                ),
                alice,
            )

            const idx = await getForeignIdToAssetIndex(api, loc998)
            expect(idx).not.toBeNull()
            expect(await getAssetIndexToForeignId(api, idx!)).toEqual(
                assetLocationJson(99800),
            )

            // Destroy it.
            await submitAndWait(
                api,
                api.tx.foreignAssets.startDestroy(loc998),
                alice,
            )
            await submitAndWait(
                api,
                api.tx.foreignAssets.finishDestroy(loc998),
                alice,
            )

            expect(await getAssetIndexToForeignId(api, idx!)).toBeNull()
            expect(await getForeignIdToAssetIndex(api, loc998)).toBeNull()
        }),
)

// ---------------------------------------------------------------------------
// Test 6: ERC20 precompile works for foreign asset via eth-rpc
// ---------------------------------------------------------------------------

Deno.test(
    'polkadot-tests: ERC20 precompile works for foreign asset',
    opts,
    () =>
        withApi(async (api, alice) => {
            const loc500 = assetLocation(50000)

            // Create foreign asset with metadata and mint tokens.
            await submitAndWait(
                api,
                api.tx.sudo.sudo(
                    api.tx.foreignAssets.forceCreate(
                        loc500,
                        alice.address,
                        false,
                        1,
                    ),
                ),
                alice,
            )
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

            // Use raw JSON-RPC eth_call (read-only, no funded wallet needed).
            const rpcUrl = `http://localhost:${
                Deno.env.get('RPC_PORT') ?? '8545'
            }`
            const ethCall = async (selector: Hex): Promise<Hex> => {
                const resp = await fetch(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_call',
                        params: [
                            { to: precompileAddr, data: selector },
                            'latest',
                        ],
                        id: 1,
                    }),
                })
                const json = (await resp.json()) as {
                    result?: string
                    error?: { message: string; code: number }
                }
                if (json.error) {
                    throw new Error(
                        `eth_call failed: ${json.error.message} (${json.error.code})`,
                    )
                }
                if (!json.result) {
                    throw new Error(
                        `eth_call returned no result: ${JSON.stringify(json)}`,
                    )
                }
                return json.result as Hex
            }

            const [nameResult, symbolResult, decimalsResult, supplyResult] =
                await Promise.all([
                    ethCall('0x06fdde03'), // name()
                    ethCall('0x95d89b41'), // symbol()
                    ethCall('0x313ce567'), // decimals()
                    ethCall('0x18160ddd'), // totalSupply()
                ])

            // Sanity-check that the precompile address is correct and returned data.
            for (const r of [nameResult, symbolResult, decimalsResult, supplyResult]) {
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
