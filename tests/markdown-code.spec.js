import { test, expect } from '@playwright/test';

const source = page => page.keyboard.press('Control+Shift+M');
async function open(page, content) {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({ name:'code.md', mimeType:'text/markdown', buffer:Buffer.from(content) });
}

test('mainstream Markdown structures retain their meaning after rich editing and export', async ({page}) => {
  const content='# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six\n\n**bold** and *italic* and ~~strike~~ with `inline()`\n\n- parent\n  - child\n\n1. first\n2. second\n\n- [ ] task\n\n> quote\n\n---\n\n[Example](https://example.com)';
  await open(page,content);
  await expect(page.locator('.tiptap h6')).toHaveText('Six');
  await expect(page.locator('.tiptap ul ul')).toHaveCount(1);
  await expect(page.locator('.tiptap s')).toHaveText('strike');
  await expect(page.locator('.tiptap blockquote')).toHaveText('quote');
  await page.locator('.tiptap h1').click();await page.keyboard.press('End');await page.keyboard.type(' edited');
  await source(page);const saved=await page.locator('#source-editor').inputValue();
  expect(saved).toContain('###### Six');expect(saved).toContain('`inline()`');expect(saved).toContain('- [ ] task');
  await source(page);await expect(page.locator('.tiptap h1')).toHaveText('One edited');
  await expect(page.locator('.tiptap ol li')).toHaveCount(2);await expect(page.locator('.tiptap hr')).toHaveCount(1);
});

test('typed code fences, language choice, tabs, undo and block exit work together', async ({page}) => {
  await page.goto('/');await page.locator('.tiptap h1').click();await page.keyboard.press('Enter');
  await page.keyboard.type('```python ');await page.keyboard.type('print("hello")');
  await expect(page.locator('.tiptap pre code')).toHaveText('print("hello")');
  await expect(page.locator('#code-language')).toHaveValue('python');
  await page.keyboard.press('Home');await page.keyboard.press('Tab');
  await expect(page.locator('.tiptap pre code')).toHaveText('  print("hello")');
  await page.keyboard.press('Control+z');await expect(page.locator('.tiptap pre code')).toHaveText('print("hello")');
  await page.keyboard.press('End');await page.keyboard.press('Enter');await page.keyboard.press('Enter');await page.keyboard.press('Enter');
  await page.keyboard.type('back to prose');await expect(page.locator('.tiptap > p').filter({hasText:'back to prose'})).toHaveText('back to prose');
});

test('partial multiline code selection indents whole lines and reverses without changing code', async ({page}) => {
  await open(page,'```text\nalpha\nbeta\ngamma\n```');
  await page.locator('.tiptap pre code').click();
  await page.locator('.tiptap').evaluate(el=>{el.editor.commands.setTextSelection({from:2,to:8});el.editor.view.focus();});
  await page.keyboard.press('Tab');
  await expect(page.locator('.tiptap pre code')).toHaveText('  alpha\n  beta\ngamma');
  await page.keyboard.press('Shift+Tab');await expect(page.locator('.tiptap pre code')).toHaveText('alpha\nbeta\ngamma');
  await page.keyboard.press('Control+z');await expect(page.locator('.tiptap pre code')).toHaveText('  alpha\n  beta\ngamma');
});

test('source indentation keeps the final unselected line unchanged and supports native undo', async ({page}) => {
  await open(page,'```py\nalpha\nbeta\ngamma\n```');await source(page);
  const field=page.locator('#source-editor');await field.focus();
  const original=await field.inputValue();
  await field.evaluate(el=>{const start=el.value.indexOf('alpha');el.setSelectionRange(start,el.value.indexOf('gamma'));});
  await page.keyboard.press('Tab');await expect(field).toHaveValue(/\n  alpha\n  beta\ngamma/);
  await page.keyboard.press('Control+z');await expect(field).toHaveValue(original);
  await field.evaluate(el=>{el.setSelectionRange(0,0);});await page.keyboard.press('Tab');await expect(field).toHaveValue('  '+original);
});

test('extended code languages, aliases and backtick-containing code survive a Markdown roundtrip', async ({page}) => {
  const code='const fence = "```";\n<script>window.injected = true</script>';
  await open(page,'````js\n'+code+'\n````\n\n~~~yml\nname: Tekaku\n~~~\n\n```rust\nfn main() { println!("ok"); }\n```\n\n```custom-language\nkeep this\n```');
  await expect(page.locator('.tiptap pre')).toHaveCount(4);
  await page.locator('.tiptap pre').first().click();await expect(page.locator('#code-language')).toHaveValue('javascript');
  for(const language of ['cpp','csharp','java','powershell','dockerfile'])await expect(page.locator(`#code-language option[value=${language}]`)).toHaveCount(1);
  await page.locator('.tiptap pre').nth(1).click();await expect(page.locator('#code-language')).toHaveValue('yaml');
  await page.locator('.tiptap pre').nth(2).click();await expect(page.locator('#code-language')).toHaveValue('rust');await expect(page.locator('.tiptap pre').nth(2).locator('.hljs-keyword')).toContainText('fn');
  await page.locator('#code-language').selectOption('cpp');await expect(page.locator('#code-language')).toHaveValue('cpp');
  await source(page);const value=await page.locator('#source-editor').inputValue();
  expect(value).toContain('````js\n'+code+'\n````');expect(value).toContain('```custom-language\nkeep this');
  await source(page);await expect(page.locator('.tiptap pre code').first()).toHaveText(code);
  expect(await page.evaluate(()=>window.injected)).toBeUndefined();
});

test('Tab and Shift Tab change list nesting without losing items',async({page})=>{
  await open(page,'- first\n- second\n- third');
  await page.locator('.tiptap li p').filter({hasText:'second'}).click();await page.keyboard.press('Tab');
  await expect(page.locator('.tiptap ul ul li')).toHaveText('second');
  await page.keyboard.press('Shift+Tab');await expect(page.locator('.tiptap ul ul')).toHaveCount(0);
  await expect(page.locator('.tiptap li')).toHaveCount(3);
});

test('context block insertion, inline code, code wrapping and copy are available without a toolbar', async ({page}) => {
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await page.goto('/');await page.locator('.tiptap h1').click();await page.keyboard.type('test');
  await page.keyboard.press('Shift+F10');await page.locator('#context-style').click();
  await page.locator('[data-heading-level="6"]').click();await expect(page.locator('.tiptap h6')).toHaveText('test');
  await page.keyboard.press('Shift+F10');await page.locator('#context-style').click();await page.locator('[data-heading-level="0"]').click();await page.locator('.tiptap p').first().click();await page.keyboard.press('End');
  await page.keyboard.press('Control+e');await page.keyboard.type(' inline ');await page.keyboard.press('Control+e');
  await expect(page.locator('.tiptap p code')).toHaveText(' inline ');
  await page.keyboard.press('End');await page.keyboard.press('Enter');await page.keyboard.press('Shift+F10');await page.locator('#context-insert').click();await page.locator('#code-insert').click();
  await page.keyboard.type('const x = 42;');await page.locator('#code-language').selectOption('javascript');
  await page.locator('#code-wrap').click();expect(await page.locator('.tiptap pre').evaluate(el=>getComputedStyle(el).whiteSpace)).toBe('pre-wrap');
  await page.locator('#code-copy').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('const x = 42;');
  await expect(page.locator('.toolbar')).toBeHidden();
});
