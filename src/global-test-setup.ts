import { cleanupTests, setupTests } from './test-setup.ts'

console.log('🔧 Running global test setup...')
await setupTests()

globalThis.addEventListener('unload', () => {
    console.log('🧹 Running global test cleanup...')
    cleanupTests()
})
