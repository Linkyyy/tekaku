import { test, expect } from '@playwright/test';

const longDocument = '# Long document\n\n' + Array.from({ length: 70 }, (_, n) => `## Section ${n + 1}\n\nText for section ${n + 1}.`).join('\n\n');
async function openLongDocument(page) {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({name:'long.md',mimeType:'text/markdown',buffer:Buffer.from(longDocument)});
}
async function bounds(page, selector) { return page.locator(selector).boundingBox(); }

test('document scrollbar is after the outline and all panels scroll below the fixed app title', async ({ page }) => {
  await openLongDocument(page);
  const title = await bounds(page,'#titlebar'), preview = await bounds(page,'.page-scroll'), outline = await bounds(page,'#outline-panel');
  expect(title.y).toBe(0); expect(preview.y).toBeGreaterThanOrEqual(title.height);
  const bar = await bounds(page,'#document-scrollbar');
  expect(Math.abs(bar.x - outline.x - outline.width)).toBeLessThan(1);
  await page.locator('.page-scroll').evaluate(el => { el.scrollTop = 1500; });
  await expect.poll(() => page.locator('.page-scroll').evaluate(el => el.scrollTop)).toBeGreaterThan(1000);
  await page.locator('#outline').evaluate(el => { el.scrollTop = 800; });
  expect(await bounds(page,'#titlebar')).toEqual(title);
  expect((await bounds(page,'.outline-heading')).y).toBe(title.height);
  await page.locator('#expand').click(); await expect(page.locator('#sidebar')).toBeVisible();
  expect((await bounds(page,'.brand')).y).toBeGreaterThanOrEqual(title.height);
  await page.locator('.sidebar-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
  expect(await bounds(page,'#titlebar')).toEqual(title);
  expect(await page.evaluate(() => document.scrollingElement.scrollTop)).toBe(0);
});

test('source fills the same editor viewport, retains scroll positions and centers each view icon', async ({ page }) => {
  await openLongDocument(page);
  const frame = await bounds(page,'.editor-surface');
  await page.locator('.page-scroll').evaluate(el => { el.scrollTop = 1200; });
  const beforeScroll = await page.locator('.page-scroll').evaluate(el => el.scrollTop);
  const button = await bounds(page,'#source'), other = await bounds(page,'#toggle-outline');
  expect(button.y + button.height / 2).toBe(other.y + other.height / 2);
  for (const mode of ['source','preview']) {
    await expect(page.locator(`[data-view-icon=${mode}]`)).toBeVisible();
    const icon = await bounds(page,`[data-view-icon=${mode}]`), current = await bounds(page,'#source');
    expect(Math.abs(icon.x + icon.width / 2 - current.x - current.width / 2)).toBeLessThan(0.5);
    expect(Math.abs(icon.y + icon.height / 2 - current.y - current.height / 2)).toBeLessThan(0.5);
    await page.locator('#source').click();
    if (mode === 'source') {
      expect(await bounds(page,'.editor-surface')).toEqual(frame);
      const source = await bounds(page,'#source-editor');
      expect(source.width).toBe(frame.width); expect(source.height).toBe(frame.height);
      expect(source.y).toBe(frame.y);
      await page.locator('#source-editor').evaluate(el => { el.scrollTop = 500; });
      await expect(page.locator('#source')).toHaveAttribute('aria-label','查看预览');
    }
  }
  expect(await bounds(page,'.editor-surface')).toEqual(frame);
  expect(await bounds(page,'#source')).toEqual(button);
  expect(await page.locator('.page-scroll').evaluate(el => el.scrollTop)).toBe(beforeScroll);
  await page.locator('#source').click();
  expect(await page.locator('#source-editor').evaluate(el => el.scrollTop)).toBe(500);
});

test('settings body scrolls while its title and footer stay in place', async ({ page }) => {
  await page.setViewportSize({width:900,height:600}); await page.goto('/'); await page.keyboard.press('Control+,');
  const heading = await bounds(page,'.settings-heading'), footer = await bounds(page,'.settings-footer');
  const body = page.locator('.settings-body');
  expect(await body.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(page.locator('#register-association')).toBeInViewport();
  expect(await bounds(page,'.settings-heading')).toEqual(heading); expect(await bounds(page,'.settings-footer')).toEqual(footer);
  expect(await page.locator('#settings-dialog').evaluate(el => el.scrollTop)).toBe(0);
  await page.locator('#close-settings').click(); await expect(page.locator('#settings-dialog')).toBeHidden();
});

test('Markdown guide pairs syntax and examples under fixed tabs, title and close button', async ({ page }) => {
  await page.setViewportSize({width:900,height:600}); await page.goto('/'); await page.locator('#expand').click(); await page.locator('#help').click();
  await page.locator('#guide-markdown').click();
  await expect(page.locator('#guide-markdown')).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#shortcuts-panel')).toBeHidden();
  await expect(page.locator('.markdown-guide-row')).toHaveCount(15);
  await expect(page.locator('.guide-result blockquote')).toHaveText('引用文字');
  await expect(page.locator('.guide-input').filter({hasText:'表格'}).locator('code')).toHaveText('| 名称 | 状态 |\n| --- | --- |\n| 手书 | 完成 |');
  const title = await bounds(page,'.help-heading'), tabs = await bounds(page,'.guide-tabs'), close = await bounds(page,'#close-help');
  await page.locator('#help-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(page.locator('.guide-result table')).toBeInViewport();
  expect(await bounds(page,'.help-heading')).toEqual(title); expect(await bounds(page,'.guide-tabs')).toEqual(tabs); expect(await bounds(page,'#close-help')).toEqual(close);
  expect(await page.locator('#help-dialog').evaluate(el => el.scrollTop)).toBe(0);
  await page.locator('#guide-markdown').focus(); await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#guide-shortcuts')).toBeFocused(); await expect(page.locator('#shortcuts-panel')).toBeVisible();
  expect(await page.locator('#help-body').evaluate(el => el.scrollTop)).toBe(0);
  await page.locator('#close-help').click(); await expect(page.locator('#help-dialog')).toBeHidden();
});

test('floating sidebar toggle stays bottom-left through panel transitions and rapid changes', async ({ page }) => {
  await page.goto('/'); const initial = await bounds(page,'#expand'), title = await bounds(page,'#titlebar');
  expect(initial.x).toBeLessThan(25); expect(initial.y).toBeGreaterThan(page.viewportSize().height - 65);
  expect(await page.locator('#expand').evaluate(el => el.closest('#titlebar'))).toBeNull();
  await page.locator('#expand').click(); await expect(page.locator('#sidebar')).toBeVisible();
  await expect.poll(() => page.locator('main').evaluate(el => el.getBoundingClientRect().x)).toBe(232);
  const opened = await bounds(page,'#expand');
  expect(opened.x).toBe(initial.x + 232); expect(opened.y).toBe(initial.y); expect(await bounds(page,'#titlebar')).toEqual(title);
  await page.evaluate(() => { for (let n=0;n<5;n++)document.querySelector('#expand').click(); for(let n=0;n<6;n++)document.querySelector('#toggle-outline').click(); });
  await expect(page.locator('#sidebar')).toBeHidden(); await expect(page.locator('#outline-panel')).toBeVisible();
  await expect(page.locator('#sidebar')).toHaveAttribute('inert','');
  expect(await bounds(page,'#expand')).toEqual(initial);
});

test('panel animations can be disabled without lingering interactive content', async ({ page }) => {
  await page.goto('/'); await page.keyboard.press('Control+,'); await page.locator('#panel-animations').uncheck(); await page.locator('#close-settings').click();
  await page.locator('#expand').click(); await expect(page.locator('#sidebar')).toBeVisible();
  await page.locator('#expand').click(); await page.locator('#toggle-outline').click();
  await expect(page.locator('#sidebar')).toBeHidden(); await expect(page.locator('#outline-panel')).toBeHidden();
  await expect(page.locator('#toggle-outline')).toBeFocused();
  expect(await page.locator('.editor-surface').evaluate(el => el.getBoundingClientRect().width)).toBe(page.viewportSize().width - 12);
});
