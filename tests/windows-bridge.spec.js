import { test, expect } from '@playwright/test';

test('native document operations work without localStorage', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { 'tekaku-draft': JSON.stringify({ name: '恢复.md', content: '# 本地恢复\n\n未完成的想法' }) };
    window.nativeCalls = [];
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('No storage origin'); } });
    window.desktop = {
      readState: async () => ({ ...state }), writeState: async (key, value) => { state[key] = value; },
      dirty: async value => window.nativeCalls.push(['dirty', value]), initialFile: async () => null,
      open: async () => ({ name: 'Windows.md', content: '# Windows 原生打开' }),
      save: async data => { window.nativeCalls.push(['save', data]); return { name: 'Windows.md' }; },
      new: async () => true,
    };
  });
  await page.goto('/'); await expect(page.locator('.tiptap h1')).toHaveText('本地恢复');
  await page.keyboard.press('Control+o'); await page.locator('#confirm-discard').click();
  await expect(page.locator('.tiptap h1')).toHaveText('Windows 原生打开');
  await page.keyboard.press('Control+Shift+M');
  await page.locator('#source-editor').fill('# Windows 已编辑\n\n中文保存'); await page.keyboard.press('Control+s');
  await expect(page.locator('#save-state')).toHaveText('已保存');
  const saves = await page.evaluate(() => window.nativeCalls.filter(call => call[0] === 'save'));
  expect(saves).toEqual([['save', { content: '# Windows 已编辑\n\n中文保存', saveAs: false }]]);
});

test('draft writes coalesce and surface disk errors', async ({ page }) => {
  await page.addInitScript(() => {
    window.draftWrites = [];
    window.desktop = { readState: async () => ({}), writeState: async (key, value) => { window.draftWrites.push([key, value]); throw new Error('disk full'); }, dirty: async () => {}, new: async () => true };
  });
  await page.goto('/'); await page.keyboard.press('Control+Shift+M');
  for (const value of ['# a', '# ab', '# abc', '# 最终草稿']) await page.locator('#source-editor').fill(value);
  await expect.poll(() => page.evaluate(() => window.draftWrites.length)).toBe(1);
  await expect(page.locator('#toast')).toHaveText('本地草稿写入失败，请保存文档到文件');
  const writes = await page.evaluate(() => window.draftWrites);
  expect(JSON.parse(writes[0][1]).content).toBe('# 最终草稿');
});

test('custom title controls and close guard preserve a canceled save', async ({ page }) => {
  await page.addInitScript(() => {
    window.actions = [];
    let full = true;
    window.desktop = {
      readState: async () => ({}), writeState: async () => {}, dirty: async () => {},
      save: async () => null,
      window: async action => { window.actions.push(action); if (action === 'fullscreen') full = !full; if (action === 'exit-fullscreen' || action === 'maximize') full = false; return { fullscreen: full, maximized: false }; },
    };
  });
  await page.goto('/'); await expect(page.locator('body')).toHaveClass(/is-fullscreen/);
  await page.locator('#window-minimize').click();
  await page.locator('#window-maximize').click();
  await expect(page.locator('#window-maximize')).toHaveAttribute('aria-label', '最大化窗口');
  await page.keyboard.press('F11'); await expect(page.locator('body')).toHaveClass(/is-fullscreen/);
  await page.keyboard.press('Control+,'); await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveClass(/is-fullscreen/);
  await page.keyboard.press('Escape'); await expect(page.locator('body')).not.toHaveClass(/is-fullscreen/);
  await page.locator('.tiptap h1').click(); await page.keyboard.type('未保存标题');
  await page.evaluate(() => window.dispatchEvent(new Event('tekaku-close-request')));
  await page.locator('#confirm-save').click(); await expect(page.locator('#confirm-dialog')).toBeHidden();
  expect(await page.evaluate(() => window.actions)).not.toContain('close-confirmed');
  await expect(page.locator('.tiptap h1')).toHaveText('未保存标题');
  await page.evaluate(() => window.dispatchEvent(new Event('tekaku-close-request')));
  await page.locator('#confirm-discard').click();
  await expect.poll(() => page.evaluate(() => window.actions)).toContain('close-confirmed');
});

test('save failures appear in themed dialogs and retain unsaved state', async ({ page }) => {
  await page.addInitScript(() => {
    window.desktop = { readState: async () => ({}), writeState: async () => {}, dirty: async () => {}, save: async () => { throw new Error('文件被其他程序占用'); } };
  });
  await page.goto('/'); await page.locator('.tiptap h1').click(); await page.keyboard.type('保留内容');
  await page.evaluate(() => window.dispatchEvent(new Event('tekaku-close-request')));
  await page.locator('#confirm-save').click();
  await expect(page.locator('#confirm-dialog')).toBeHidden();
  await expect(page.locator('#error-dialog')).toBeVisible();
  await expect(page.locator('#error-message')).toHaveText('文件被其他程序占用');
  await page.locator('#error-close').click();
  await expect(page.locator('#save-state')).toHaveText('未保存');
  await expect(page.locator('.tiptap h1')).toHaveText('保留内容');
});
