import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/types.ts'],
      // The algorithm is the product. This threshold is not negotiable and CI
      // enforces it -- see docs/05-ENGINEERING.md.
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
