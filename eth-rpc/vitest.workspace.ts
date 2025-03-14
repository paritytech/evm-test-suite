import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
    {
        test: {
            globals: true,
            name: 'unit',
            globalSetup: './src/test-setup.ts',
            include: ['./src/*.test.ts'],
        },
    },
])
