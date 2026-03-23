/// ForeignAssetId CallbackHandle integration tests.
///
/// These are Polkadot-specific: they test that pallet-assets extrinsics
/// (create, force_create, start_destroy/finish_destroy) trigger the
/// ForeignAssetId callback, and that the ERC20 precompile is reachable
/// at the derived foreign asset address.
///
/// They require the kitchensink node (not revive-dev-node) and do NOT
/// run against geth.

import {
    ApiPromise,
    Keyring,
    SubmittableResult,
    WsProvider,
} from '@polkadot/api'
import type { AddressOrPair, SubmittableExtrinsic } from '@polkadot/api/types'
import type { Hex } from 'viem'
import { expect } from '@std/expect'
import { getEnv, sanitizeOpts as opts } from './util.ts'

// Minimal type aliases for unaugmented storage return values.
// @polkadot/types is a transitive dep and not in the import map,
// so we define the shapes we need inline.
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

// ERC20 precompile address for an asset using InlineIdConfig.
// The kitchensink runtime uses InlineIdConfig<0x1> for Instance1, meaning the
// asset ID is embedded directly in bytes 0-3 of the address.
// Layout: bytes 0-3 = asset ID, bytes 4-15 = zeros,
//         bytes 16-17 = prefix (0x0001), bytes 18-19 = zeros.
function inlineAssetPrecompileAddress(assetId: number): Hex {
    const hex = assetId.toString(16).padStart(8, '0')
    return `0x${hex}00000000000000000000000000010000` as Hex
}

/// Submit a signed extrinsic and wait for inclusion.
function submitAndWait(
    api: ApiPromise,
    tx: SubmittableExtrinsic<'promise'>,
    signer: AddressOrPair,
): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.signAndSend(
            signer,
            ({ status, dispatchError }: SubmittableResult) => {
                if (status.isInBlock || status.isFinalized) {
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
        )
    })
}

async function getNextAssetIndex(api: ApiPromise): Promise<number> {
    const val = await api.query.assetsPrecompiles.nextAssetIndex()
    return (val as unknown as ScaleU32).toNumber()
}

async function getAssetIndexToForeignId(
    api: ApiPromise,
    index: number,
): Promise<number | null> {
    const val = await api.query.assetsPrecompiles.assetIndexToForeignAssetId(
        index,
    )
    const opt = val as unknown as ScaleOption<ScaleU32>
    return opt.isSome ? opt.unwrap().toNumber() : null
}

async function getForeignIdToAssetIndex(
    api: ApiPromise,
    assetId: number,
): Promise<number | null> {
    const val = await api.query.assetsPrecompiles.foreignAssetIdToAssetIndex(
        assetId,
    )
    const opt = val as unknown as ScaleOption<ScaleU32>
    return opt.isSome ? opt.unwrap().toNumber() : null
}

// ---------------------------------------------------------------------------
// Test 1: Asset creation populates foreign asset mapping
// ---------------------------------------------------------------------------

Deno.test(
    'polkadot-tests: create populates foreign asset mapping',
    opts,
    async () => {
        const provider = new WsProvider(SUBSTRATE_WS)
        const api = await ApiPromise.create({ provider })
        const keyring = new Keyring({ type: 'sr25519' })
        const alice = keyring.addFromUri('//Alice')

        try {
            const nextIdx = await getNextAssetIndex(api)
            expect(nextIdx).toEqual(0)
            expect(await getAssetIndexToForeignId(api, 0)).toBeNull()

            // Create asset 42.
            await submitAndWait(
                api,
                api.tx.assets.create(42, alice.address, 1),
                alice,
            )

            expect(await getNextAssetIndex(api)).toEqual(1)
            expect(await getAssetIndexToForeignId(api, 0)).toEqual(42)
            expect(await getForeignIdToAssetIndex(api, 42)).toEqual(0)

            // Create asset 100 — verify sequential indexing.
            await submitAndWait(
                api,
                api.tx.assets.create(100, alice.address, 1),
                alice,
            )

            expect(await getNextAssetIndex(api)).toEqual(2)
            expect(await getAssetIndexToForeignId(api, 1)).toEqual(100)
            expect(await getForeignIdToAssetIndex(api, 100)).toEqual(1)
        } finally {
            await api.disconnect()
        }
    },
)

// ---------------------------------------------------------------------------
// Test 2: Asset destruction cleans up mapping
// ---------------------------------------------------------------------------

Deno.test(
    'polkadot-tests: destroy cleans up foreign asset mapping',
    opts,
    async () => {
        const provider = new WsProvider(SUBSTRATE_WS)
        const api = await ApiPromise.create({ provider })
        const keyring = new Keyring({ type: 'sr25519' })
        const alice = keyring.addFromUri('//Alice')

        try {
            // Create two assets.
            await submitAndWait(
                api,
                api.tx.assets.create(200, alice.address, 1),
                alice,
            )
            await submitAndWait(
                api,
                api.tx.assets.create(201, alice.address, 1),
                alice,
            )

            const idx200 = await getForeignIdToAssetIndex(api, 200)
            expect(idx200).not.toBeNull()
            const idx201 = await getForeignIdToAssetIndex(api, 201)
            expect(idx201).not.toBeNull()

            // Destroy asset 200.
            await submitAndWait(
                api,
                api.tx.assets.startDestroy(200),
                alice,
            )
            await submitAndWait(
                api,
                api.tx.assets.finishDestroy(200),
                alice,
            )

            // Mapping for 200 should be gone.
            expect(await getAssetIndexToForeignId(api, idx200!)).toBeNull()
            expect(await getForeignIdToAssetIndex(api, 200)).toBeNull()

            // NextAssetIndex should NOT be decremented.
            const nextIdx = await getNextAssetIndex(api)
            expect(nextIdx).toBeGreaterThan(idx201!)

            // Asset 201 should be unaffected.
            expect(await getAssetIndexToForeignId(api, idx201!)).toEqual(201)
        } finally {
            await api.disconnect()
        }
    },
)

// ---------------------------------------------------------------------------
// Test 3: Re-created asset gets a new index
// ---------------------------------------------------------------------------

Deno.test(
    'polkadot-tests: re-created asset gets new index',
    opts,
    async () => {
        const provider = new WsProvider(SUBSTRATE_WS)
        const api = await ApiPromise.create({ provider })
        const keyring = new Keyring({ type: 'sr25519' })
        const alice = keyring.addFromUri('//Alice')

        try {
            // Create asset 300.
            await submitAndWait(
                api,
                api.tx.assets.create(300, alice.address, 1),
                alice,
            )
            const oldIndex = await getForeignIdToAssetIndex(api, 300)
            expect(oldIndex).not.toBeNull()

            // Destroy it.
            await submitAndWait(
                api,
                api.tx.assets.startDestroy(300),
                alice,
            )
            await submitAndWait(
                api,
                api.tx.assets.finishDestroy(300),
                alice,
            )
            expect(await getForeignIdToAssetIndex(api, 300)).toBeNull()

            // Re-create — should get a new, higher index.
            await submitAndWait(
                api,
                api.tx.assets.create(300, alice.address, 1),
                alice,
            )
            const newIndex = await getForeignIdToAssetIndex(api, 300)
            expect(newIndex).not.toBeNull()
            expect(newIndex).not.toEqual(oldIndex)
            expect(newIndex!).toBeGreaterThan(oldIndex!)

            // Reverse lookup works.
            expect(await getAssetIndexToForeignId(api, newIndex!)).toEqual(300)
        } finally {
            await api.disconnect()
        }
    },
)

// ---------------------------------------------------------------------------
// Test 4: force_create also triggers callback
// ---------------------------------------------------------------------------

Deno.test(
    'polkadot-tests: force_create triggers callback',
    opts,
    async () => {
        const provider = new WsProvider(SUBSTRATE_WS)
        const api = await ApiPromise.create({ provider })
        const keyring = new Keyring({ type: 'sr25519' })
        const alice = keyring.addFromUri('//Alice')

        try {
            const nextBefore = await getNextAssetIndex(api)

            await submitAndWait(
                api,
                api.tx.sudo.sudo(
                    api.tx.assets.forceCreate(
                        999,
                        alice.address,
                        false,
                        1,
                    ),
                ),
                alice,
            )

            const nextAfter = await getNextAssetIndex(api)
            expect(nextAfter).toEqual(nextBefore + 1)

            const mapping = await getForeignIdToAssetIndex(api, 999)
            expect(mapping).not.toBeNull()
            expect(
                await getAssetIndexToForeignId(api, mapping!),
            ).toEqual(999)
        } finally {
            await api.disconnect()
        }
    },
)

// ---------------------------------------------------------------------------
// Test 5: force_destroy cleans up mapping
// ---------------------------------------------------------------------------

Deno.test(
    'polkadot-tests: force_destroy cleans up mapping',
    opts,
    async () => {
        const provider = new WsProvider(SUBSTRATE_WS)
        const api = await ApiPromise.create({ provider })
        const keyring = new Keyring({ type: 'sr25519' })
        const alice = keyring.addFromUri('//Alice')

        try {
            // force_create asset 998.
            await submitAndWait(
                api,
                api.tx.sudo.sudo(
                    api.tx.assets.forceCreate(
                        998,
                        alice.address,
                        false,
                        1,
                    ),
                ),
                alice,
            )

            const idx = await getForeignIdToAssetIndex(api, 998)
            expect(idx).not.toBeNull()
            expect(await getAssetIndexToForeignId(api, idx!)).toEqual(998)

            // Destroy it.
            await submitAndWait(
                api,
                api.tx.assets.startDestroy(998),
                alice,
            )
            await submitAndWait(
                api,
                api.tx.assets.finishDestroy(998),
                alice,
            )

            expect(await getAssetIndexToForeignId(api, idx!)).toBeNull()
            expect(await getForeignIdToAssetIndex(api, 998)).toBeNull()
        } finally {
            await api.disconnect()
        }
    },
)

// ---------------------------------------------------------------------------
// Test 6: ERC20 precompile works for foreign asset via eth-rpc
// ---------------------------------------------------------------------------

Deno.test(
    'polkadot-tests: ERC20 precompile works for foreign asset',
    opts,
    async () => {
        const provider = new WsProvider(SUBSTRATE_WS)
        const api = await ApiPromise.create({ provider })
        const keyring = new Keyring({ type: 'sr25519' })
        const alice = keyring.addFromUri('//Alice')

        try {
            // Create asset 500 with metadata and mint tokens.
            await submitAndWait(
                api,
                api.tx.assets.create(500, alice.address, 1),
                alice,
            )
            await submitAndWait(
                api,
                api.tx.assets.setMetadata(500, 'Test Token', 'TST', 18),
                alice,
            )
            await submitAndWait(
                api,
                api.tx.assets.mint(
                    500,
                    alice.address,
                    '1000000000000000000000',
                ),
                alice,
            )

            const index = await getForeignIdToAssetIndex(api, 500)
            expect(index).not.toBeNull()
            const precompileAddr = inlineAssetPrecompileAddress(500)

            // Use viem to call the ERC20 precompile via eth-rpc.
            const env = await getEnv()

            // name()
            const nameResult = await env.publicClient.request({
                method: 'eth_call',
                params: [
                    {
                        to: precompileAddr,
                        // name() selector = 0x06fdde03
                        data: '0x06fdde03' as Hex,
                    },
                    'latest',
                ],
            })
            // ABI-encoded string "Test Token" should be in the result.
            const nameDecoded = decodeAbiString(nameResult as Hex)
            expect(nameDecoded).toEqual('Test Token')

            // symbol()
            const symbolResult = await env.publicClient.request({
                method: 'eth_call',
                params: [
                    {
                        to: precompileAddr,
                        // symbol() selector = 0x95d89b41
                        data: '0x95d89b41' as Hex,
                    },
                    'latest',
                ],
            })
            const symbolDecoded = decodeAbiString(symbolResult as Hex)
            expect(symbolDecoded).toEqual('TST')

            // decimals()
            const decimalsResult = await env.publicClient.request({
                method: 'eth_call',
                params: [
                    {
                        to: precompileAddr,
                        // decimals() selector = 0x313ce567
                        data: '0x313ce567' as Hex,
                    },
                    'latest',
                ],
            })
            const decimals = parseInt(decimalsResult as string, 16)
            expect(decimals).toEqual(18)

            // totalSupply()
            const supplyResult = await env.publicClient.request({
                method: 'eth_call',
                params: [
                    {
                        to: precompileAddr,
                        // totalSupply() selector = 0x18160ddd
                        data: '0x18160ddd' as Hex,
                    },
                    'latest',
                ],
            })
            const supply = BigInt(supplyResult as string)
            expect(supply > 0n).toBe(true)
        } finally {
            await api.disconnect()
        }
    },
)

/// Decode an ABI-encoded string return value.
function decodeAbiString(hex: Hex): string {
    // Remove 0x prefix.
    const data = hex.slice(2)
    // First 32 bytes: offset to string data.
    // Next 32 bytes: string length.
    const lengthHex = data.slice(64, 128)
    const length = parseInt(lengthHex, 16)
    // Following bytes: UTF-8 string data.
    const strHex = data.slice(128, 128 + length * 2)
    const bytes = new Uint8Array(
        strHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
    )
    return new TextDecoder().decode(bytes)
}
