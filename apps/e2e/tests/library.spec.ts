import { expect, test } from '@playwright/test';
import { PASSWORD, register, settled } from './helpers';

/**
 * A deck that its author keeps improving, followed by someone else.
 *
 * Two accounts in one browser, in turn: the author publishes and edits, the
 * follower subscribes, reviews a card, and comes back to find the author's
 * edit in place and their own progress intact. Checked after fresh loads,
 * so it is the server's record.
 */
test('publish a deck, follow it, and receive an edit without losing progress', async ({ page }) => {
  test.setTimeout(180_000);

  const signOut = async () => {
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).not.toHaveURL(/\/settings/);
  };
  const signIn = async (email: string) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/today');
  };

  // The author: a deck with two cards, published.
  const author = await register(page, 'author');
  await page.goto('/decks');
  await settled(page);
  await page.getByRole('button', { name: /New deck|Create your first deck/ }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill('E2E Rivers');
  await dialog.getByRole('button', { name: 'Create deck' }).click();
  await page.waitForURL(/\/decks\/[a-z0-9]+$/);
  const deckUrl = page.url();
  await settled(page);
  const CARDS: [string, string][] = [
    ['Longest river in Africa?', 'The Nile'],
    ['Longest river in South America?', 'The Amazon'],
  ];
  for (const [front, back] of CARDS) {
    await page.getByRole('button', { name: /Add card/ }).first().click();
    const card = page.getByRole('dialog');
    await card.getByLabel('Front').fill(front);
    await card.getByLabel('Back').fill(back);
    await card.getByRole('button', { name: 'Save and close' }).click();
    await expect(page.getByText(front)).toBeVisible();
  }
  await page.getByRole('button', { name: 'Deck options' }).click();
  await page.getByRole('menuitem', { name: 'Publish to the library' }).click();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('In the library').first()).toBeVisible();
  await expect(page.getByText('0 followers')).toBeVisible();
  await signOut();

  // The follower: finds it, follows it, reviews a card.
  const follower = await register(page, 'follower');
  await page.goto('/library');
  await settled(page);
  await page.getByRole('link', { name: 'E2E Rivers' }).first().click();
  await page.waitForURL(/\/library\/[a-z0-9]+$/);
  await settled(page);
  await expect(page.getByText('The Nile')).toBeVisible();
  await page.getByRole('button', { name: 'Follow this deck' }).click();
  await page.waitForURL(/\/decks\/[a-z0-9]+$/);
  const copyUrl = page.url();
  expect(copyUrl).not.toBe(deckUrl);
  await settled(page);
  await expect(page.getByText('Following').first()).toBeVisible();
  await expect(page.getByText('Up to date with the author.')).toBeVisible();

  await page.goto('/review');
  await expect(page.getByText(/Longest river in/).first()).toBeVisible();
  const asked = (await page.getByText(/Longest river in/).first().textContent()) ?? '';
  await page.getByRole('button', { name: 'Show answer' }).click();
  await page.getByRole('button', { name: /^Good/ }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('recallify-outbox')), { timeout: 30_000 })
    .toBeNull();
  await signOut();

  // The author corrects the card the follower just studied, and says why.
  await signIn(author);
  await page.goto(deckUrl);
  await settled(page);
  await expect(page.getByText('1 follower')).toBeVisible();
  await page.getByRole('button', { name: asked.trim() }).click();
  const edit = page.getByRole('dialog');
  await edit.getByLabel('Back').fill('Corrected by the author');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Corrected by the author')).toBeVisible();
  await page.getByRole('button', { name: 'Add a note' }).click();
  await page.getByRole('dialog').getByLabel('Note').fill('Fixed a wrong answer.');
  await page.getByRole('dialog').getByRole('button', { name: 'Add note' }).click();
  await expect(page.getByText('Fixed a wrong answer.')).toBeVisible();
  await signOut();

  // The follower's copy takes the edit on arrival; the card is still learning.
  await signIn(follower);
  await page.goto(copyUrl);
  await settled(page);
  await expect(page.getByText(/Brought up to date: 1 edited/)).toBeVisible();
  await expect(page.getByText('Corrected by the author')).toBeVisible();
  await expect(page.getByText('Up to date with the author.')).toBeVisible();
  await page.getByRole('button', { name: asked.trim() }).click();
  await expect(page.getByRole('dialog').getByText('Learning')).toBeVisible();
});
