import { defineConfig } from 'vitest/config';

// No coverage threshold here on purpose. These files are declarations, so a
// coverage number would measure how many schemas were touched, not whether the
// rules they encode are actually enforced. The tests assert the rules instead.
// See docs/05-ENGINEERING.md -- coverage is enforced only where it means
// something, which is the engine and the optimizer.
export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
