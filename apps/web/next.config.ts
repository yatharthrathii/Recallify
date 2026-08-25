import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship raw TypeScript; Next compiles them in-place.
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
  async rewrites() {
    // BFF proxy. The browser only ever talks to this origin; the Next route
    // layer attaches the token from the httpOnly cookie and forwards to NestJS.
    // See docs/02-ARCHITECTURE.md, "Request flow".
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_URL ?? 'http://localhost:3001'}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
