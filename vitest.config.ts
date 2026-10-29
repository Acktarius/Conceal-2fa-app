import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.unit.test.ts', 'tests/**/*.e2e.test.ts'],
    globals: false,
  },
});
