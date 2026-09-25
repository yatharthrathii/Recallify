import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll } from './helpers';

const PAGES = [
  ['/', 'A flashcard scheduler that shows its work.'],
  ['/how-it-works', 'Review a card just before you would have forgotten it.'],
  ['/android', 'The app is in development. The engine it needs is already done.'],
  ['/about', 'A study tool that refuses to overstate itself.'],
  ['/terms', 'The short agreement for using Recallify.'],
  ['/privacy', 'What is stored, where it goes, and how to delete it.'],
] as const;

test.describe('public site', () => {
  for (const [path, heading] of PAGES) {
    test(`${path} renders, fits the screen, and throws nothing`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));

      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expectNoHorizontalScroll(page);
      expect(errors).toEqual([]);
    });
  }

  test('every internal link on the front page resolves', async ({ page, request }) => {
    await page.goto('/');
    const hrefs = await page.$$eval('a[href^="/"]', (links) => [
      ...new Set(links.map((a) => a.getAttribute('href') ?? '')),
    ]);
    expect(hrefs.length).toBeGreaterThan(5);
    for (const href of hrefs) {
      const res = await request.get(href, { maxRedirects: 0 });
      expect(res.status(), href).toBeLessThan(400);
    }
  });

  test('the only outbound link is the maker profile, never the repository', async ({ page }) => {
    await page.goto('/about');
    const external = await page.$$eval('a[href^="http"]', (links) =>
      links.map((a) => a.getAttribute('href')),
    );
    for (const href of external) expect(href).toBe('https://github.com/yatharthrathii');
  });

  test('signed out visitors are sent to sign in, and back afterwards', async ({ page }) => {
    await page.goto('/stats');
    await expect(page).toHaveURL(/\/login\?next=%2Fstats/);
  });

  test('robots, sitemap and share image are served', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(await robots.text()).toContain('Disallow: /today');
    expect((await request.get('/sitemap.xml')).ok()).toBe(true);
    const og = await request.get('/opengraph-image');
    expect(og.headers()['content-type']).toContain('image/png');
  });

  test('an unknown address is a real 404 page', async ({ page }) => {
    const res = await page.goto('/no-such-page');
    expect(res?.status()).toBe(404);
    await expect(page.getByText('There is no page here.')).toBeVisible();
  });
});
