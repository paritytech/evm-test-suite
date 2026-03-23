// Entry point for Polkadot-specific tests.
// These tests require the kitchensink node (not revive-dev-node) and do NOT
// compare results against geth.
//
// Run with: deno task test:polkadot

import { cleanupTests, setupTests } from './test-setup.ts'

await setupTests()
await import('./foreign-assets.test.ts')

globalThis.addEventListener('unload', () => {
    cleanupTests()
})
