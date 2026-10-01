import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { deleteAccount, register, settled } from './helpers';

const FIXTURES = join(__dirname, '..', 'fixtures');

/**
 * Bringing history in, and reading it back out.
 *
 * A CSV arrives as new cards. A deck export arrives with six months of
 * reviews, read in the browser from the zstd-compressed collection, and the
 * Memory Report made from it includes a fit. The exam forecast then has cards
 * to project. Everything is checked against what the app shows after a fresh
 * load, so it is the server's record, not the page's optimism.
 */
test('import a CSV, then a deck export with history, and read the report', async ({ page }) => {
  test.setTimeout(180_000);
  await register(page, 'import');

  // A text file: three cards, one with a hint, no history.
  await page.goto('/import');
  await page.getByLabel('File to import', { exact: true }).setInputFiles(join(FIXTURES, 'sample.csv'));
  await expect(page.getByText('A text file carries no history')).toBeVisible();
  await expect(page.getByLabel('Deck name for sample', { exact: true })).toHaveValue('sample');
  await page.getByLabel('Deck name for sample', { exact: true }).fill('Odds and ends');
  await page.getByRole('button', { name: 'Import 3 cards' }).click();
  await expect(page.getByText(/Imported 3 cards and 0 reviews into 1 deck\./)).toBeVisible();

  await page.getByRole('link', { name: 'Open decks' }).click();
  await settled(page);
  await expect(page.getByRole('link', { name: 'Odds and ends' })).toBeVisible();

  // The export: read on the device, previewed, sent in parts.
  await page.goto('/import');
  await page.getByLabel('File to import', { exact: true }).setInputFiles(join(FIXTURES, 'sample.apkg'));
  await expect(page.getByText(/3 decks/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel('Deck name for Japanese / Vocabulary', { exact: true })).toBeVisible();
  // What was left behind is said before the button, not after.
  await expect(page.getByText(/refers to images or audio/)).toBeVisible();
  await expect(page.getByText(/skipped because one side had no text/)).toBeVisible();
  await expect(page.getByText(/left out: manual reschedules/)).toBeVisible();

  await page.getByRole('button', { name: /^Import 85 cards and [0-9,]+ reviews$/ }).click();
  await expect(page.getByText(/Imported 85 cards and [0-9,]+ reviews into 3 decks\./)).toBeVisible({
    timeout: 60_000,
  });

  // Counted on the server: the reviews came with the cards.
  await page.goto('/stats');
  await settled(page);
  await expect(page.getByText(/^[0-9,]+ of [0-9,]+ reviews needed$/)).toBeVisible();
  const needed = await page.getByText(/^[0-9,]+ of [0-9,]+ reviews needed$/).textContent();
  const reviews = Number((needed ?? '').split(' ')[0]!.replace(/,/g, ''));
  expect(reviews).toBeGreaterThanOrEqual(400);

  // The exam forecast has cards to project now.
  await expect(page.getByText(/cards still known in \d+ days/)).toBeVisible();
  await expect(page.getByText('Most likely gone by then')).toBeVisible();

  // The report: fitted, in sentences, stored.
  await page.getByRole('link', { name: 'Make my report' }).click();
  await page.waitForURL('**/stats/report');
  await settled(page);
  await page.getByRole('button', { name: 'Make my report' }).click();
  await expect(page.getByRole('heading', { name: 'Findings' })).toBeVisible({ timeout: 60_000 });
  const findings = page.getByRole('list').filter({ hasText: /new card you answer Good once/ });
  expect(await findings.getByRole('listitem').count()).toBeGreaterThanOrEqual(4);
  await expect(page.getByText(/The fit says a new card/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adopt these parameters' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cards that keep failing' })).toBeVisible();

  // Made once: the button now waits, and a reload shows the same report.
  await expect(page.getByRole('button', { name: 'Make a new report' })).toBeDisabled();
  await page.reload();
  await settled(page);
  await expect(page.getByText(/The fit says a new card/)).toBeVisible();

  // Importing the same file again is refused, deck by deck, and adds nothing.
  await page.goto('/import');
  await page.getByLabel('File to import', { exact: true }).setInputFiles(join(FIXTURES, 'sample.apkg'));
  await page.getByRole('button', { name: /^Import 85 cards/ }).click();
  await expect(page.getByText('Already imported. Nothing was added twice.').first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(/Imported 0 cards and 0 reviews into 0 decks\./)).toBeVisible();

  // The fixture's review ids are the same on every run, and the id is the
  // primary key across the whole table. Against a database shared between
  // runs, leaving this account behind would make the next run's first import
  // read as a repeat.
  await deleteAccount(page);
});
