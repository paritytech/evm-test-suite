// Global test setup - runs once before all tests
import { cleanupTests, setupTests } from './test-setup.ts'

await setupTests()
await import('./block-info.test.ts')
await import('./errors.test.ts')
await import('./gas.test.ts')
await import('./methods.test.ts')
await import('./others.test.ts')
await import('./tracing-call-trace.test.ts')
await import('./tracing-opcode.test.ts')
await import('./tracing-prestate.test.ts')

globalThis.addEventListener('unload', () => {
    cleanupTests()
})
