import type { NextConfig } from 'next';

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
  ],
  // Stable and top-level in Next 16 (it left `experimental` in this release).
  // Auto-memoises components, which keeps useMemo noise out of the review hot
  // path -- see the <50ms budget in docs/05-ENGINEERING.md.
  reactCompiler: true,
  // No rewrites. /api/v1 is a real route handler (app/api/v1/[...path]) because
  // a rewrite cannot read the httpOnly cookie and attach the bearer header.
};

export default nextConfig;
