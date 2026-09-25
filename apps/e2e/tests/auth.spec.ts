import { expect, test } from '@playwright/test';
import { PASSWORD, register, uniqueEmail } from './helpers';

test.describe('accounts', () => {
  test('register, sign out, sign back in', async ({ page }) => {
    const email = await register(page, 'auth');
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();

    // The front page stays reachable, and knows who is there.
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Open the app' }).first()).toBeVisible();

    await page.goto('/settings');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).not.toHaveURL(/\/settings/);

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/today');
  });

  test('a wrong password says so without saying which part was wrong', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(uniqueEmail('nobody'));
    await page.getByLabel('Password', { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    // Next keeps its own empty route announcer with role=alert on every page.
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveText(
      'Email or password is incorrect.',
    );
  });

  test('the password can be shown and hidden', async ({ page }) => {
    await page.goto('/login');
    const field = page.getByLabel('Password', { exact: true });
    await field.fill('hunter2hunter2');
    await expect(field).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(field).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(field).toHaveAttribute('type', 'password');
  });

  test('forgot password gives the same answer for any address', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await page.getByLabel('Email').fill(uniqueEmail('forgot'));
    await page.getByRole('button', { name: 'Send the link' }).click();
    await expect(page.getByText('The link is on its way.')).toBeVisible();
  });

  test('a reset link with no token explains itself', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByRole('heading', { name: 'This link is incomplete.' })).toBeVisible();
  });
});
