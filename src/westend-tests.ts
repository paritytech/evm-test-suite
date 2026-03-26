// Westend live runtime smoke tests — validates eth-rpc requests
// against the live Westend asset-hub runtime.
// Run with: deno task test:westend

import { cleanupTests, setupTests } from './test-setup.ts'

await setupTests()
await import('./westend.test.ts')

globalThis.addEventListener('unload', () => {
    cleanupTests()
})
