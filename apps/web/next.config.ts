import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { NextConfig } from 'next';

/**
 * The SQLite engine the import page loads, copied into public/ so the browser
 * fetches it as two static files. Its loader is written for Node, workers and
 * browsers at once, and a bundler that follows every branch of it ships
 * polyfills for the ones that do not apply; a script tag sidesteps that.
 *
 * Done here, when the config loads, rather than in a package.json `prebuild`
 * hook: a host that runs `next build` directly never runs npm lifecycle
 * scripts, and the copy would silently be missing from production. The copy
 * is gitignored.
 */
function copySqlJs(): void {
  const dist = join(__dirname, 'node_modules', 'sql.js', 'dist');
  const out = join(__dirname, 'public', 'vendor', 'sqljs');
  mkdirSync(out, { recursive: true });
  for (const file of ['sql-wasm.js', 'sql-wasm.wasm']) {
    copyFileSync(join(dist, file), join(out, file));
  }
}
copySqlJs();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next writes AGENTS.md and CLAUDE.md into the app by default. This repo has
  // its own working agreement at the root, and generated files do not belong
  // in version control beside it.
  agentRules: false,
  // The floating dev badge sits on top of the account menu in the sidebar.
  devIndicators: false,
  // Workspace packages, compiled in place by Next.
  transpilePackages: [
    '@recallify/tokens',
    '@recallify/core',
    '@recallify/fsrs',
    '@recallify/contracts',
    '@recallify/import',
  ],
  // Stable and top-level in Next 16 (it left `experimental` in this release).
  // Auto-memoises components, which keeps useMemo noise out of the review hot
  // path -- see the <50ms budget in docs/05-ENGINEERING.md.
  reactCompiler: true,
  // The service worker must never be cached by the browser's HTTP cache, or a
  // fixed bug would keep being served from the old copy for a day.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
  // No rewrites. /api/v1 is a real route handler (app/api/v1/[...path]) because
  // a rewrite cannot read the httpOnly cookie and attach the bearer header.
};

export default nextConfig;
