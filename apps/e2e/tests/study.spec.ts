import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, register, settled } from './helpers';

/**
 * The loop the product exists for: make a deck, add a card, review it, and see
 * the review counted. Checked against what the app shows after a reload, not
 * only the optimistic screen.
 */
test('make a deck, add a card, review it, see it counted', async ({ page }) => {
  await register(page, 'study');

  await page.goto('/decks');
  await settled(page);
  // An empty account offers its first deck; later ones come from the header.
  await page.getByRole('button', { name: /New deck|Create your first deck/ }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill('E2E Capitals');
  await dialog.getByRole('button', { name: 'Create deck' }).click();
  await page.waitForURL(/\/decks\/[a-z0-9]+$/);
  await settled(page);

  await page.getByRole('button', { name: /Add card/ }).first().click();
  const card = page.getByRole('dialog');
  await card.getByLabel('Front').fill('Capital of Japan?');
  await card.getByLabel('Back').fill('Tokyo');
  await card.getByRole('button', { name: 'Save and close' }).click();
  await expect(page.getByText('Capital of Japan?')).toBeVisible();
  await expectNoHorizontalScroll(page);

  // The card is two-sided: the question is printed on both faces.
  await page.goto('/review');
  await expect(page.getByText('Capital of Japan?').first()).toBeVisible();
  await page.getByRole('button', { name: 'Show answer' }).click();
  await expect(page.getByText('Tokyo').first()).toBeVisible();
  await page.getByRole('button', { name: /^Good/ }).click();

  // The answer leaves the outbox once the server has it.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('recallify-outbox')), {
      timeout: 30_000,
    })
    .toBeNull();

  // Counted on the server, read back after a fresh load.
  await page.goto('/stats');
  await settled(page);
  await expect(page.getByText(/^1 of [0-9,]+ reviews needed$/)).toBeVisible();
});
