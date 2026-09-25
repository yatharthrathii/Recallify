import { expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export const PASSWORD = 'correct-horse-battery';

export function uniqueEmail(label: string): string {
  return `e2e-${label}-${randomUUID()}@recallify.test`;
}

/** Register through the real form and land in the app. */
export async function register(page: Page, label: string): Promise<string> {
  const email = uniqueEmail(label);
  await page.goto('/register');
  await page.getByLabel('Name').fill('E2E');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/today');
  return email;
}

/** Nothing on the page may be wider than the viewport. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(1);
}

/** Waits until every loading skeleton has been replaced by data. */
export async function settled(page: Page): Promise<void> {
  await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 30_000 });
}
