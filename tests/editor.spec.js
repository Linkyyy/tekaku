import { test, expect } from '@playwright/test';
const source = page => page.keyboard.press('Control+Shift+M');
async function newDoc(page) { await page.keyboard.press('Control+n'); }

test('fresh homepage is white and minimal, with an empty title placeholder', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'white');
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('.toolbar')).toBeHidden();
  await expect(page.locator('footer')).toBeHidden();
  await expect(page.locator('.tiptap h1')).toHaveText('');
  await expect(page.locator('.tiptap h1')).toHaveAttribute('data-placeholder', '请输入标题');
  await expect(page.locator('.document-meta')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('你的文字，自有力量');
  await expect(page.locator('#filename')).toHaveText('未命名.md');
  await source(page);
  await expect(page.locator('#source-editor')).not.toHaveValue(/请输入标题/);
  expect(errors).toEqual([]);
});

test('Markdown input, slash keyboard menu and Chinese draft restore', async ({ page }) => {
  await page.goto('/'); await newDoc(page);
  const editor = page.locator('.tiptap');
  await editor.pressSequentially('Hello');
  await expect(editor.locator('h1')).toHaveText('Hello');
  await editor.press('Enter'); await editor.pressSequentially('/');
  await expect(page.locator('#slash-menu')).toBeVisible();
  await editor.press('ArrowDown'); await editor.press('ArrowDown'); await editor.press('Enter');
  await editor.pressSequentially('A chapter');
  await expect(editor.locator('h2')).toHaveText('A chapter');
  await source(page);
  await expect(page.locator('#source-editor')).toHaveValue(/# Hello[\s\S]*## A chapter/);
  await page.locator('#source-editor').fill('# 中文测试\n\n**加粗内容**\n\n- [ ] 任务');
  await source(page);
  await expect(editor.locator('h1')).toHaveText('中文测试');
  await expect(editor.locator('strong')).toHaveText('加粗内容');
  page.on('dialog', dialog => dialog.accept()); await page.reload();
  await expect(editor.locator('h1')).toHaveText('中文测试');
});

test('opens Markdown, updates checkboxes and exports the edited document', async ({ page }) => {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({ name: 'sample.md', mimeType: 'text/markdown', buffer: Buffer.from('# Imported\n\nSome **bold** text.\n\n- [ ] Task\n\n```js\nconsole.log(1)\n```') });
  await expect(page.locator('#filename')).toHaveText('sample.md');
  await expect(page.locator('.tiptap pre code')).toContainText('console.log(1)');
  await page.locator('.tiptap input[type=checkbox]').check();
  const downloadPromise = page.waitForEvent('download'); await page.keyboard.press('Control+s');
  const download = await downloadPromise; expect(download.suggestedFilename()).toBe('sample.md');
  const stream = await download.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const content = Buffer.concat(chunks).toString();
  expect(content).toContain('# Imported'); expect(content).toContain('**bold**'); expect(content).toContain('- [x] Task');
  expect(content).not.toContain('请输入标题');
});

test('custom discard dialog protects changes and new documents receive a blank title', async ({ page }) => {
  await page.goto('/'); await page.locator('.tiptap h1').click(); await page.keyboard.type('Keep this');
  await newDoc(page); await expect(page.locator('#confirm-dialog')).toBeVisible();
  await page.locator('#confirm-cancel').click();
  await expect(page.locator('.tiptap h1')).toHaveText('Keep this');
  await newDoc(page); await page.locator('#confirm-discard').click();
  await expect(page.locator('.tiptap h1')).toHaveText('');
  await expect(page.locator('.tiptap h1')).toHaveAttribute('data-placeholder', '请输入标题');
  await expect(page.locator('#save-state')).toHaveText('已保存');
});

test('viewing source without editing leaves an opened document saved', async ({ page }) => {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({ name: 'clean.md', mimeType: 'text/markdown', buffer: Buffer.from('# Unchanged') });
  await source(page); await source(page);
  await expect(page.locator('#save-state')).toHaveText('已保存');
  await expect(page.locator('.tiptap h1')).toHaveText('Unchanged');
});
