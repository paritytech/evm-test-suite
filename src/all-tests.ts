// Global test setup - runs once before all tests
import { cleanupTests, setupTests } from './test-setup.ts'

await setupTests()

// Import all test files (this will register all the tests)
// IMPORTANT: These imports must happen AFTER setupTests() is called
await import('./methods.test.ts')
await import('./errors.test.ts')
await import('./others.test.ts')
await import('./tracing-call-trace.test.ts')
await import('./tracing-prestate.test.ts')

// Cleanup after all tests
globalThis.addEventListener('unload', () => {
    // console.log('🧹 Running global test cleanup...')
    cleanupTests()
})
