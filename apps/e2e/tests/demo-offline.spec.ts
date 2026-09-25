import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { settled } from './helpers';

test.describe('demo and offline', () => {
  // Every run gets its own address for the demo rate limit.
  test.use({ extraHTTPHeaders: { 'x-forwarded-for': `e2e-${randomUUID()}` } });

  test('the demo opens with months of history and says what it is', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Try the demo' }).click();
    await page.waitForURL('**/today', { timeout: 60_000 });
    await settled(page);
    await expect(page.getByText('This is a demo account')).toBeVisible();
    await expect(page.getByText(/cards? (is|are) due/)).toBeVisible();

    // Enough history for the optimizer to be tried, not greyed out.
    await page.goto('/stats');
    await settled(page);
    await expect(page.getByRole('button', { name: 'Fit to my history' })).toBeEnabled();
  });

  test('review works with no connection and syncs when it returns', async ({ page, context }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Try the demo' }).click();
    await page.waitForURL('**/today', { timeout: 60_000 });

    await page.goto('/review');
    await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible();
    // The service worker takes control on the next load.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true);
    await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible();
    await page.getByRole('button', { name: 'Show answer' }).click();
    await page.getByRole('button', { name: /^Good/ }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem('recallify-outbox') ?? '[]').length as number,
        ),
      )
      .toBe(1);

    // A page never opened on this device explains itself instead of failing.
    await page.goto('/stats').catch(() => undefined);
    await expect(page.getByText('This page has not been opened on this device yet.')).toBeVisible();

    await context.setOffline(false);
    await page.goto('/review');
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('recallify-outbox')), {
        timeout: 45_000,
      })
      .toBeNull();

    // Signing out removes the cached cards.
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).not.toHaveURL(/\/settings/);
    const left = await page.evaluate(async () => (await caches.keys()).join(','));
    expect(left).not.toContain('recallify-data');
  });
});
