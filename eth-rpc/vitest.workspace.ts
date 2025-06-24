import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
    {
        test: {
            globals: true,
            name: 'unit',
            hookTimeout: 45_000,
            testTimeout: 45_000,
            globalSetup: './src/test-setup.ts',
            include: ['./src/*.test.ts'],
        },
    },
])
