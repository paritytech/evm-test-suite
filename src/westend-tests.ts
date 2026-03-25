// Entry point for Westend live network tests.
// These tests run stateless RPC queries against eth-rpc connected to
// the live Westend asset-hub, validating runtime API compatibility.
//
// Run with: deno task test:westend

import { cleanupTests, setupTests } from './test-setup.ts'

await setupTests()
await import('./westend.test.ts')

globalThis.addEventListener('unload', () => {
    cleanupTests()
})
