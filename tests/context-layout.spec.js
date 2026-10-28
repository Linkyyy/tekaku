import { test, expect } from '@playwright/test';

async function openMenu(page, group) {
  await page.keyboard.press('Shift+F10');
  await expect(page.locator('#editor-context-menu')).toBeVisible();
  if (group) await page.locator('#context-' + group).click();
}
async function load(page, content) {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({ name: 'guide.md', mimeType: 'text/markdown', buffer: Buffer.from(content) });
}
async function clipboardMock(page) {
  await page.addInitScript(() => {
    window.clip = '';
    window.desktop = {
      readState: async () => ({}), writeState: async () => {}, dirty: async () => {},
      clipboardRead: async () => window.clip,
      clipboardWrite: async value => { window.clip = value; },
    };
  });
}

test('outline is a right column with its own scrolling and a persistent visibility switch', async ({ page }) => {
  await load(page, '# Guide\n\n' + Array.from({ length: 40 }, (_, i) => `## Chapter ${i + 1}\n\nParagraph`).join('\n\n'));
  const outline = page.locator('#outline-panel');
  await expect(outline).toBeVisible();
  await expect(page.locator('#outline button')).toHaveCount(41);
  const panel = await outline.boundingBox(), editor = await page.locator('.editor-surface').boundingBox();
  expect(panel.x).toBeGreaterThanOrEqual(editor.x + editor.width - 1);
  expect(await page.locator('#outline').evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await page.locator('#outline button').filter({ hasText: 'Chapter 35', exact: true }).click();
  await expect.poll(() => page.locator('.page-scroll').evaluate(el => el.scrollTop)).toBeGreaterThan(200);
  await page.locator('#toggle-outline').click();
  await expect(outline).toBeHidden();
  await page.reload(); await expect(outline).toBeHidden();
  await page.locator('#toggle-outline').click(); await expect(outline).toBeVisible();
  const corner = await page.locator('#source').boundingBox();
  const viewport = page.viewportSize();
  const surface = await page.locator('.editor-surface').boundingBox();
  expect(corner.x).toBeGreaterThan(surface.x + surface.width - 70);
  expect(corner.y).toBeGreaterThan(viewport.height - 70);
  await page.locator('#source').click(); await expect(page.locator('#source-editor')).toBeVisible();
  await expect(page.locator('#source')).toHaveAttribute('aria-pressed', 'true');
});

test('right-click keeps a rich text selection and clipboard paste inserts literal text safely', async ({ page }) => {
  await clipboardMock(page); await load(page, '# Title\n\nalpha beta gamma');
  await page.locator('.tiptap').evaluate(el => {
    let pos; el.editor.state.doc.descendants((node, at) => { if (node.isText && node.text.includes('alpha')) pos = at; });
    el.editor.commands.setTextSelection({ from: pos + 6, to: pos + 10 }); el.editor.view.focus();
  });
  const point = await page.locator('.tiptap').evaluate(el => el.editor.view.coordsAtPos(el.editor.state.selection.from + 1));
  await page.mouse.click(point.left, point.top + 4, { button: 'right' });
  await page.locator('#context-copy').click();
  await expect.poll(() => page.evaluate(() => window.clip)).toBe('beta');
  await page.evaluate(() => { window.clip = '<script>window.injected=true</script>\nsecond line'; });
  await openMenu(page); await page.locator('#context-paste').click();
  await expect(page.locator('.tiptap')).toContainText('<script>window.injected=true</script>');
  await expect(page.locator('.tiptap')).toContainText('second line');
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await page.keyboard.press('Control+z'); await expect(page.locator('.tiptap p')).toHaveText('alpha beta gamma');
});

test('insertion submenu handles rich tables and opens image dialogs without stealing their focus', async ({ page }) => {
  await page.goto('/'); await page.locator('.tiptap h1').click(); await page.keyboard.press('Enter');
  await openMenu(page, 'insert'); await page.locator('#table-insert').click();
  await expect(page.locator('.tiptap table')).toHaveCount(1);
  await expect(page.locator('.context-menu:visible')).toHaveCount(0);
  await page.keyboard.press('ArrowDown');
  await openMenu(page, 'insert'); await page.locator('#image-insert').click();
  await expect(page.locator('#image-dialog')).toBeVisible(); await expect(page.locator('#image-url')).toBeFocused();
  await page.locator('#image-url').fill('https://example.com/picture.png');
  await page.locator('#image-alt').fill('Picture'); await page.locator('#image-form .primary-button').click();
  await expect(page.locator('.image-node img')).toHaveAttribute('alt', 'Picture');
  await expect(page.locator('.sidebar #table-insert, .sidebar #image-insert')).toHaveCount(0);
});

test('source context insertion preserves selection, supports undo and inserts links as Markdown', async ({ page }) => {
  await clipboardMock(page); await load(page, '# Title\n\nalpha beta gamma'); await page.locator('#source').click();
  const field = page.locator('#source-editor');
  await field.focus(); await field.evaluate(el => { const at = el.value.indexOf('beta'); el.setSelectionRange(at, at + 4); });
  await openMenu(page, 'insert'); await page.locator('#inline-code').click();
  await expect(field).toHaveValue('# Title\n\nalpha `beta` gamma');
  await page.keyboard.press('Control+z'); await expect(field).toHaveValue('# Title\n\nalpha beta gamma');
  await field.evaluate(el => { const at = el.value.indexOf('beta'); el.setSelectionRange(at, at + 4); });
  await openMenu(page, 'insert'); await page.locator('#link-edit').click();
  await expect(page.locator('#link-text')).toHaveValue('beta'); await expect(page.locator('#link-remove')).toBeHidden();
  await page.locator('#link-url').fill('https://example.com/a'); await page.locator('#link-form .primary-button').click();
  await expect(field).toHaveValue('# Title\n\nalpha [beta](<https://example.com/a>) gamma');
  await field.evaluate(el => { el.setSelectionRange(0, 7); }); await field.focus();
  await openMenu(page); await page.locator('#context-cut').click();
  await expect.poll(() => page.evaluate(() => window.clip)).toBe('# Title');
  await expect(field).toHaveValue('\n\nalpha [beta](<https://example.com/a>) gamma');
  await openMenu(page); await page.locator('#context-paste').click();
  await expect(field).toHaveValue('# Title\n\nalpha [beta](<https://example.com/a>) gamma');
});

test('context menus fit the viewport and keyboard navigation closes them before fullscreen exits', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 500 });
  await page.addInitScript(() => {
    window.actions = []; window.desktop = {
      readState: async () => ({}), writeState: async () => {}, dirty: async () => {},
      window: async action => { window.actions.push(action); return { fullscreen: true, maximized: false }; },
    };
  });
  await page.goto('/'); await page.locator('.tiptap h1').click();
  await page.locator('.tiptap').evaluate(el => el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 718, clientY: 498 })));
  await page.keyboard.press('End'); await expect(page.locator('#context-insert')).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(page.locator('#code-insert')).toBeFocused();
  for (const selector of ['#editor-context-menu', '#insert-context-menu']) {
    const box = await page.locator(selector).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(7); expect(box.y).toBeGreaterThanOrEqual(7);
    expect(box.x + box.width).toBeLessThanOrEqual(713); expect(box.y + box.height).toBeLessThanOrEqual(493);
  }
  await page.keyboard.press('ArrowLeft'); await expect(page.locator('#context-insert')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.locator('.context-menu:visible')).toHaveCount(0);
  expect(await page.evaluate(() => window.actions)).not.toContain('exit-fullscreen');
});

test('association controls report native registration, removal and actionable errors', async ({ page }) => {
  await page.addInitScript(() => {
    window.operations = []; let registered = false;
    window.desktop = { readState: async () => ({}), writeState: async () => {}, dirty: async () => {}, integration: async action => {
      window.operations.push(action);
      if (action === 'register' && window.failRegistration) throw new Error('无法写入文件关联');
      if (action === 'register') registered = true; if (action === 'remove') registered = false;
      return { registered, message: registered ? '已加入打开方式' : '尚未加入打开方式' };
    } };
  });
  await page.goto('/'); await page.keyboard.press('Control+,');
  await expect(page.locator('#remove-association')).toBeDisabled();
  await page.locator('#register-association').click(); await expect(page.locator('#association-status')).toHaveText('已加入打开方式');
  await page.locator('#remove-association').click(); await expect(page.locator('#association-status')).toHaveText('尚未加入打开方式');
  await page.evaluate(() => { window.failRegistration = true; }); await page.locator('#register-association').click();
  await expect(page.locator('#error-message')).toHaveText('无法写入文件关联'); await page.locator('#error-close').click();
  await expect(page.locator('#settings-dialog')).toBeVisible();
  expect(await page.evaluate(() => window.operations)).toEqual(['status', 'register', 'remove', 'register']);
});

test('shortcut guide groups keycaps, follows the skin and scrolls within the window', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 }); await page.goto('/');
  await page.keyboard.press('Control+,'); await page.locator('[data-theme-choice=night]').click(); await page.locator('#close-settings').click();
  await page.locator('#expand').click(); await page.locator('#help').click();
  await expect(page.locator('.shortcut-group h3')).toHaveText(['标签与文件','编辑','查找与插入','视图']);
  await expect(page.locator('.shortcut-group').filter({hasText:'切换源码'}).locator('kbd').first()).toHaveText('Ctrl');
  const dialog = await page.locator('#help-dialog').boundingBox(); expect(dialog.height).toBeLessThanOrEqual(516);
  expect(await page.locator('#help-body').evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await page.keyboard.press('Escape'); await expect(page.locator('#help-dialog')).toBeHidden();
});

for (const scale of [1, 1.25, 1.5, 2]) test(`window controls stay inside the screen at DPI scale ${scale}`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 720, height: 500 }, deviceScaleFactor: scale });
  try {
    await context.addInitScript(() => { window.desktop = {
      readState: async () => ({}), writeState: async () => {}, dirty: async () => {},
      initialFile: async () => ({ name: '很长的文档标题'.repeat(20) + '.md', content: '# Title' }),
      window: async () => ({ fullscreen: true, maximized: false }),
    }; });
    const page = await context.newPage(); await page.goto('http://127.0.0.1:5173');
    for (const expanded of [false, true]) {
      if (expanded) await page.locator('#expand').click();
      for (const selector of ['#window-minimize', '#window-maximize', '#window-close']) {
        const button = page.locator(selector); await expect(button).toBeVisible(); const rect = await button.boundingBox();
        expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.x + rect.width).toBeLessThanOrEqual(712);
        expect(rect.y).toBeGreaterThanOrEqual(0); expect(rect.y + rect.height).toBeLessThanOrEqual(500);
        expect(await button.evaluate(el => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === el; })).toBe(true);
      }
    }
  } finally { await context.close(); }
});
