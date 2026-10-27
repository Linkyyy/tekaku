import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('embedded desktop HTML boots under its CSP without origin storage or network access', async ({ page }) => {
  const html = await readFile('native/web/index.html', 'utf8');
  const errors = []; const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto('about:blank');
  expect(await page.evaluate(() => { try { localStorage.getItem('test'); return false; } catch { return true; } })).toBe(true);
  await page.evaluate(() => {
    window.desktop = {
      readState: async () => ({}), writeState: async () => {}, dirty: async () => {},
      initialFile: async () => ({ name: '启动文档.md', content: '# 来自 Windows\n\n启动参数已打开。' }),
      save: async data => { window.savedDocument = data.content; return { name: '启动文档.md' }; },
    };
  });
  await page.setContent(html);
  await expect(page.locator('.tiptap h1')).toHaveText('来自 Windows');
  await expect(page.locator('#filename')).toHaveText('启动文档.md');
  await page.keyboard.press('Control+Shift+M');
  await page.locator('#source-editor').fill('# 嵌入页面\n\n可以离线保存。');
  await page.keyboard.press('Control+s');
  await expect(page.locator('#save-state')).toHaveText('已保存');
  expect(await page.evaluate(() => window.savedDocument)).toBe('# 嵌入页面\n\n可以离线保存。');
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
});
