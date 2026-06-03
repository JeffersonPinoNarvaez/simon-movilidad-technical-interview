import { test, expect } from '@playwright/test';

test.describe('FleetPortal dashboard', () => {
  test('loads dashboard shell and title', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('FleetPortal')).toBeVisible({
      timeout: 15_000,
    });
  });
});
