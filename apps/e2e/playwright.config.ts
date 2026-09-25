import { defineConfig, devices } from '@playwright/test';

/**
 * End to end, against the real stack: the built API on a real Postgres and
 * the production build of the web app, driven in a real browser. Nothing is
 * mocked, because the point is to catch what unit tests cannot: a cookie on
 * the wrong path, a proxy redirect loop, a service worker that serves a stale
 * page.
 *
 * Both servers are started here from their build output. Build first:
 *
 *   pnpm build && pnpm test:e2e
 *
 * Locally an already running pair on the same ports is reused. The installed
 * Chrome is used locally; CI installs Playwright's Chromium.
 */

const WEB = Number(process.env['E2E_WEB_PORT'] ?? 3000);
const API = Number(process.env['E2E_API_PORT'] ?? 3001);
const CI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './tests',
  // One database, shared: tests make their own accounts, but running files in
  // parallel would still race on the demo and sign-in rate limits.
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], ...(CI ? {} : { channel: 'chrome' }) },
    },
    {
      name: 'phone',
      use: { ...devices['Pixel 7'], ...(CI ? {} : { channel: 'chrome' }) },
      // The phone pass checks layout and the core loop, not every flow twice.
      testMatch: /(public|study)\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'node dist/main.js',
      cwd: '../api',
      url: `http://localhost:${API}/ready`,
      reuseExistingServer: !CI,
      timeout: 120_000,
      env: { API_PORT: String(API), PORT: String(API) },
    },
    {
      command: `pnpm exec next start -p ${WEB}`,
      cwd: '../web',
      url: `http://localhost:${WEB}`,
      reuseExistingServer: !CI,
      timeout: 120_000,
      env: { API_URL: `http://localhost:${API}` },
    },
  ],
});
