import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
	{
		extends: './vitest.config.ts',
		test: {
			name: 'unit',
			include: ['./src/geth-diff.test.ts'],
		},
	},
]);
