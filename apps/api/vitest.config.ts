import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vitest transforms with esbuild, which does not implement
  // emitDecoratorMetadata. Without that metadata Nest cannot see constructor
  // parameter types, so every injected dependency arrives as undefined and the
  // whole container silently falls apart -- the first symptom is a 500 from a
  // guard whose Reflector is missing. SWC emits it, and is the same compiler
  // `nest build` already uses, so tests and production run the same transform.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.test.ts'],
    // Each file boots its own Nest app against the same database. Running them
    // in parallel would have several apps opening connection pools at once,
    // which on Neon's free tier means hitting the connection limit rather than
    // finishing faster.
    fileParallelism: false,
    // Generous, because locally this runs against a hosted Postgres and every
    // query is a real network round trip: a test that submits twelve reviews
    // is twelve sequential transactions and takes half a minute. CI runs a
    // Postgres container on the same host and finishes the whole suite in a
    // fraction of that, so this ceiling is only ever reached by a genuine hang.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
