import {test,expect} from '@playwright/test';
const data='# Read first\n\n- [ ] A task\n\n## Section\n\nText\n\n```js\nconst x = 1;\n```\n\n| A | B |\n| --- | --- |\n| C | D |';
async function open(page,content=data){await page.goto('/');await page.locator('#file-input').setInputFiles({name:'read.md',mimeType:'text/markdown',buffer:Buffer.from(content)});}

test('opened documents are read-only including task checkboxes, keymaps, undo and raw source',async({page})=>{
 await open(page);await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','false');await expect(page.locator('#toggle-editing')).toHaveText('编辑');
 await expect(page.locator('.tiptap input[type=checkbox]')).toBeDisabled();
 const before=await page.locator('.tiptap').innerHTML();await page.locator('.tiptap h1').click();await page.keyboard.press('End');await page.keyboard.type('should not edit');await page.keyboard.press('Control+b');await page.keyboard.press('Control+z');await page.keyboard.press('Backspace');
 expect(await page.locator('.tiptap').innerHTML()).toBe(before);await expect(page.locator('#save-state')).toHaveText('已保存');
 await page.locator('#source').click();await expect(page.locator('#source-editor')).toHaveJSProperty('readOnly',true);
 const raw=await page.locator('#source-editor').inputValue();await page.locator('#source-editor').focus();await page.keyboard.press('Tab');await page.keyboard.type('blocked');expect(await page.locator('#source-editor').inputValue()).toBe(raw);
});
test('editing is explicit, reading preserves unsaved changes and toggling does not change the viewport',async({page})=>{
 await open(page);const box=await page.locator('.editor-surface').boundingBox();await page.locator('#toggle-editing').click();await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','true');await page.locator('.tiptap input[type=checkbox]').check();
 await expect(page.locator('#save-state')).toHaveText('未保存');await page.locator('#toggle-editing').click();await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','false');await expect(page.locator('.tiptap input[type=checkbox]')).toBeChecked();await expect(page.locator('#save-state')).toHaveText('未保存');expect(await page.locator('.editor-surface').boundingBox()).toEqual(box);
});
test('mode is independent per tab, new documents edit immediately and reopening defaults to reading',async({page})=>{
 await open(page,'# First');await page.locator('#toggle-editing').click();await page.keyboard.press('Control+n');await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','true');
 await page.locator('#file-input').setInputFiles({name:'second.md',mimeType:'text/markdown',buffer:Buffer.from('# Second')});await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','false');await page.locator('.tab-select').first().click();await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','true');await page.reload();await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','false');
});
test('only the current empty paragraph gets an input hint, and no hints appear while reading',async({page})=>{
 await page.goto('/');await page.locator('.tiptap h1').click();await page.keyboard.type('Title');await page.keyboard.press('Enter');await page.keyboard.press('Enter');await page.keyboard.press('Enter');
 expect(await page.locator('.tiptap > p').count()).toBeGreaterThan(2);await expect(page.locator('.tiptap [data-placeholder="开始写点什么，或输入 / 添加内容…"]')).toHaveCount(1);
 await page.locator('#toggle-editing').click();await expect(page.locator('.tiptap [data-placeholder]')).toHaveCount(0);
});
test('read mode keeps copy and find while disabling context insertion, cut and replace',async({page})=>{
 await open(page);await page.locator('.tiptap h1').click({button:'right'});await expect(page.locator('#context-insert')).toBeDisabled();await expect(page.locator('#context-cut')).toBeDisabled();await expect(page.locator('#context-paste')).toBeDisabled();await page.keyboard.press('Escape');
 await page.keyboard.press('Control+f');await page.locator('#find-input').fill('Read');await expect(page.locator('#find-count')).toContainText('1');await expect(page.locator('#replace-input')).toBeHidden();await page.locator('#find-close').click();
 await page.locator('#toggle-editing').click();await page.locator('.tiptap h1').click({button:'right'});await expect(page.locator('#context-insert')).toBeEnabled();
});
test('editing raw source then returning to reading keeps the same document and changes',async({page})=>{
 await open(page);await page.locator('#toggle-editing').click();await page.locator('#source').click();await page.locator('#source-editor').fill('# Modified\n\ncontent');await page.locator('#toggle-editing').click();await expect(page.locator('.tiptap h1')).toHaveText('Modified');await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','false');await expect(page.locator('#save-state')).toHaveText('未保存');
});

test('saving an unchanged native file in reading mode does not rewrite it',async({page})=>{
 await page.addInitScript(()=>{window.saves=0;window.desktop={readState:async()=>({}),writeState:async()=>{},dirty:async()=>{},initialFile:async()=>({name:'raw.md',path:'C:\\Notes\\raw.md',content:'# Raw\n\nunchanged'}),save:async()=>{window.saves++;return {name:'raw.md'};}};});
 await page.goto('/');await expect(page.locator('.tiptap h1')).toHaveText('Raw');await page.keyboard.press('Control+s');expect(await page.evaluate(()=>window.saves)).toBe(0);await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','false');
});
