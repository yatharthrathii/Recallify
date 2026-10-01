import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/types.ts'],
      // A parser that silently drops a card, or a review, is the kind of bug
      // nobody reports: the user only sees a smaller deck. Every branch runs.
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
