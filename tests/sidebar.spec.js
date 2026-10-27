import { test, expect } from '@playwright/test';

test('menus live in the collapsible sidebar and sidebar file actions work', async ({ page }) => {
  await page.addInitScript(() => {
    window.saved = [];
    window.desktop = {
      readState: async () => ({}), writeState: async () => {}, dirty: async () => {},
      open: async () => ({ name: '侧栏打开.md', content: '# 从侧栏打开' }),
      save: async request => { window.saved.push(request); return { name: request.saveAs ? '另存为.md' : '侧栏打开.md' }; },
      new: async () => true,
    };
  });
  await page.goto('/');
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('#titlebar button')).toHaveCount(4); // sidebar toggle and native window controls only
  await expect(page.locator('#focus, #more, #more-menu')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '专注模式', exact: true })).toHaveCount(0);
  await page.locator('#expand').click(); await expect(page.locator('#expand')).toHaveAttribute('aria-expanded', 'true');
  for (const id of ['new', 'open', 'save', 'save-as', 'menu-source', 'toggle-fullscreen', 'settings', 'help']) await expect(page.locator(`.sidebar #${id}`)).toBeVisible();
  await page.locator('.sidebar #open').click();
  await expect(page.locator('.tiptap h1')).toHaveText('从侧栏打开');
  await page.locator('.sidebar #menu-source').click();
  await expect(page.locator('#source-editor')).toBeVisible();
  await expect(page.locator('#menu-source')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#source-editor').fill('# 从侧栏修改');
  await page.locator('.sidebar #save').click();
  await page.locator('.sidebar #save-as').click();
  expect(await page.evaluate(() => window.saved)).toEqual([{ content: '# 从侧栏修改', saveAs: false }, { content: '# 从侧栏修改', saveAs: true }]);
  await page.locator('.sidebar #settings').click(); await expect(page.locator('#settings-dialog')).toBeVisible();
  await page.locator('#close-settings').click();
  await page.locator('.sidebar #help').click(); await expect(page.locator('#help-dialog')).toBeVisible();
  await page.locator('#close-help').click();
  await page.locator('#expand').click(); await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('#expand')).toHaveAttribute('aria-expanded', 'false');
});

test('frame and titlebar match the selected skin and notify the native compositor', async ({ page }) => {
  await page.addInitScript(() => {
    window.actions = [];
    window.desktop = {
      readState: async () => ({}), writeState: async () => {}, dirty: async () => {},
      window: async action => { window.actions.push(action); return { fullscreen: false, maximized: false }; },
    };
  });
  await page.goto('/');
  const originalBorder = await page.locator('#app').evaluate(el => getComputedStyle(el, '::before').borderTopColor);
  expect(await page.locator('#titlebar').evaluate(el => getComputedStyle(el).backgroundImage)).toContain('linear-gradient');
  await page.keyboard.press('Control+,');
  await page.locator('[data-theme-choice=night]').click();
  await expect.poll(() => page.evaluate(() => window.actions)).toContain('theme-night');
  expect(await page.locator('#app').evaluate(el => getComputedStyle(el, '::before').borderTopColor)).not.toBe(originalBorder);
  await page.locator('[data-theme-choice=white]').click();
  await expect.poll(() => page.evaluate(() => window.actions)).toContain('theme-white');
  expect(await page.locator('#app').evaluate(el => getComputedStyle(el, '::before').borderTopColor)).toBe(originalBorder);
});
