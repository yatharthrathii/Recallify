import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/types.ts'],
      // Same rule as the engine: this is the part of the product that would be
      // wrong in a way nobody notices, so nothing ships uncovered.
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
