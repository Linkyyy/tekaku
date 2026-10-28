import { test, expect } from '@playwright/test';

test('themes, editor typography and layout settings persist after reopening', async ({ page }) => {
  await page.goto('/'); await page.locator('#expand').click(); await page.locator('.sidebar #settings').click();
  await expect(page.locator('#settings-dialog')).toBeVisible();
  await page.locator('[data-theme-choice=night]').click();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'night');
  await expect(page.locator('[data-theme-choice=night]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#setting-font').selectOption('serif');
  await page.locator('#setting-font-size').fill('20');
  await page.locator('#setting-line-height').fill('2.2');
  await page.locator('#setting-content-width').fill('1000');
  await page.locator('#show-toolbar').check(); await page.locator('#show-statusbar').check();
  await page.locator('#startup-fullscreen').uncheck(); await page.locator('#startup-sidebar').uncheck();
  await page.locator('#close-settings').click();
  await expect(page.locator('.toolbar')).toBeVisible(); await expect(page.locator('footer')).toBeVisible();
  expect(await page.locator('.tiptap').evaluate(el => getComputedStyle(el).fontSize)).toBe('20px');
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'night');
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.locator('#settings').click();
  await expect(page.locator('#setting-font-size')).toHaveValue('20');
  await expect(page.locator('#startup-fullscreen')).not.toBeChecked();
  await page.locator('#reset-settings').click();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'slate');
  await expect(page.locator('#startup-fullscreen')).toBeChecked();
  await expect(page.locator('#show-toolbar')).not.toBeChecked();
});

test('skins cover dialogs as well as the page and settings close with Escape', async ({ page }) => {
  await page.goto('/'); await page.keyboard.press('Control+,');
  for (const theme of ['paper', 'sage', 'night', 'white']) {
    await page.locator(`[data-theme-choice=${theme}]`).click();
    expect(await page.locator('#settings-dialog').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor));
  }
  await page.keyboard.press('Escape'); await expect(page.locator('#settings-dialog')).toBeHidden();
  await expect(page.locator('.tiptap h1')).toHaveText('');
});
