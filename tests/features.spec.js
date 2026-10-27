import { test, expect } from '@playwright/test';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1gAAAABJRU5ErkJggg==','base64');
const source=page=>page.keyboard.press('Control+Shift+M');
async function tools(page){await page.locator('#expand').click();await page.locator('.sidebar-tools summary').filter({hasText:'插入',exact:true}).click();}

test('local image insertion, editing and Markdown reopening retain the image',async({page})=>{
 await page.goto('/');await page.locator('.tiptap h1').click();await page.keyboard.type('图片文档');
 await page.locator('#image-input').setInputFiles({name:'测试图片.png',mimeType:'image/png',buffer:png});
 const img=page.locator('.image-node img');await expect(img).toHaveCount(1);
 await expect.poll(()=>img.evaluate(el=>el.naturalWidth)).toBe(1);
 await img.click();await page.locator('#image-edit').click();await page.locator('#image-alt').fill('一张测试图');await page.locator('#image-form .primary-button').click();
 await source(page);await expect(page.locator('#source-editor')).toHaveValue(/!\[一张测试图\]\(data:image\/png;base64,/);
 const content=await page.locator('#source-editor').inputValue();
 await source(page);await expect(page.locator('.image-node img')).toHaveAttribute('alt','一张测试图');
 await page.locator('#file-input').setInputFiles({name:'reopen.md',mimeType:'text/markdown',buffer:Buffer.from(content)});
 await expect.poll(()=>page.locator('.image-node img').evaluate(el=>el.naturalWidth)).toBe(1);
});

test('GFM table editing and highlighted code survive Markdown roundtrip',async({page})=>{
 await page.goto('/');await source(page);await page.locator('#source-editor').fill('# 表格代码\n\n| 名称 | 状态 |\n| --- | --- |\n| 图片 | 完成 |\n\n```js\nconst answer = 42;\n```');await source(page);
 await expect(page.locator('.tiptap table')).toHaveCount(1);await expect(page.locator('.hljs-keyword')).toContainText('const');await page.locator('.tiptap pre').click();await expect(page.locator('#code-language')).toHaveValue('javascript');
 await page.locator('.tiptap td').first().click();await page.locator('[data-table-action=add-row]').click();
 await expect(page.locator('.tiptap tr')).toHaveCount(3);await page.locator('[data-table-action=add-column]').click();
 await expect(page.locator('.tiptap th')).toHaveCount(3);
 await source(page);await expect(page.locator('#source-editor')).toHaveValue(/\| 名称/);await expect(page.locator('#source-editor')).toHaveValue(/```js/);
 await source(page);await expect(page.locator('.tiptap tr')).toHaveCount(3);
});

test('search replaces across marks, leaves nonmatches intact and supports source mode',async({page})=>{
 await page.goto('/');await source(page);await page.locator('#source-editor').fill('# 查找\n\nhello **world** hello world\n\nHELLO WORLD');await source(page);
 await page.keyboard.press('Control+f');await page.locator('#find-input').fill('hello world');await expect(page.locator('#find-count')).toHaveText('1 / 3');
 await page.locator('#replace-input').fill('替换结果');await page.locator('#replace-all').click();await expect(page.locator('.tiptap')).toContainText('替换结果 替换结果');
 await page.locator('#find-close').click();await source(page);await page.keyboard.press('Control+h');await page.locator('#find-input').fill('替换结果');
 await page.locator('#replace-input').fill('最终');await page.locator('#replace-all').click();await expect(page.locator('#source-editor')).toHaveValue(/最终 最终/);
});

test('links, outline and self-contained HTML export work without loading scripts',async({page})=>{
 await page.goto('/');await page.locator('.tiptap h1').click();await page.keyboard.type('导出标题');await page.keyboard.press('End');await page.keyboard.press('Enter');
 await page.keyboard.press('Control+k');await page.locator('#link-text').fill('Example');await page.locator('#link-url').fill('https://example.com');await page.locator('#link-form .primary-button').click();
 await expect(page.locator('.tiptap a')).toHaveAttribute('href','https://example.com');
 await page.locator('.tiptap a').click();await page.locator('#link-text').fill('Edited Example');await page.locator('#link-form .primary-button').click();await expect(page.locator('.tiptap a')).toHaveText('Edited Example');
 await page.locator('#image-input').setInputFiles({name:'pic.png',mimeType:'image/png',buffer:png});
 await page.locator('#expand').click();await expect(page.locator('#outline')).toContainText('导出标题');
 await page.locator('.sidebar-tools summary').filter({hasText:'工具与导出',exact:true}).click();
 const downloadPromise=page.waitForEvent('download');await page.locator('#export-html').click();const download=await downloadPromise;
 const stream=await download.createReadStream();const parts=[];for await(const c of stream)parts.push(c);const html=Buffer.concat(parts).toString();
 expect(html).toContain('data:image/png;base64,');expect(html).toContain('https://example.com');expect(html).not.toContain('<script');
});

test('native relative images hydrate without changing their Markdown source',async({page})=>{
 const data='data:image/png;base64,'+png.toString('base64');
 await page.addInitScript(data=>{window.desktop={readState:async()=>({}),writeState:async()=>{},dirty:async()=>{},initialFile:async()=>({name:'local.md',content:'# 图片\n\n![local](images/test.png)'}),resolveImages:async refs=>Object.fromEntries(refs.map(ref=>[ref,data]))};},data);
 await page.goto('/');await expect.poll(()=>page.locator('.image-node img').evaluate(el=>el.naturalWidth)).toBe(1);
 await source(page);await expect(page.locator('#source-editor')).toHaveValue(/!\[local\]\(images\/test.png\)/);
});

test('drag and clipboard insertion create independent editable image blocks',async({page})=>{
 await page.goto('/');
 await page.evaluate(base64=>{
  const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const file=new File([bytes],'drag.png',{type:'image/png'});
  const data=new DataTransfer();data.items.add(file);const el=document.querySelector('.tiptap');const r=el.getBoundingClientRect();
  el.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data,clientX:r.x+20,clientY:r.y+20}));
 },png.toString('base64'));
 await expect(page.locator('.image-node img')).toHaveCount(1);
 await page.evaluate(base64=>{
  const data=new DataTransfer();data.items.add(new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],'paste.png',{type:'image/png'}));
  document.querySelector('.tiptap').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));
 },png.toString('base64'));
 await expect(page.locator('.image-node img')).toHaveCount(2);
 await source(page);await expect(page.locator('#source-editor')).toHaveValue(/!\[drag\]/);await expect(page.locator('#source-editor')).toHaveValue(/!\[paste\]/);
});

test('native save adopts canonical attachment paths and keeps recovery metadata',async({page})=>{
 const data='data:image/png;base64,'+png.toString('base64');
 await page.addInitScript(data=>{window.states={};window.desktop={readState:async()=>({}),writeState:async(k,v)=>{window.states[k]=v;},dirty:async()=>{},resolveImages:async refs=>Object.fromEntries(refs.map(ref=>[ref,data])),save:async request=>({name:'doc.md',path:'C:\\Notes\\doc.md',content:request.content.replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g,'doc.assets/image.png')})};},data);
 await page.goto('/');await page.locator('#image-input').setInputFiles({name:'image.png',mimeType:'image/png',buffer:png});
 await expect(page.locator('.image-node img')).toHaveCount(1);await page.keyboard.press('Control+s');
 await expect(page.locator('#save-state')).toHaveText('已保存');await source(page);await expect(page.locator('#source-editor')).toHaveValue(/doc.assets\/image.png/);
 expect(await page.evaluate(()=>JSON.parse(window.states['tekaku-draft']).path)).toBe('C:\\Notes\\doc.md');
});

test('print output hides menus and placeholders while retaining the document',async({page})=>{
 await page.addInitScript(()=>{window.print=()=>{window.printRequested=true;};});
 await page.goto('/');await page.keyboard.press('Control+,');await page.locator('[data-theme-choice=night]').click();await page.locator('#close-settings').click();await page.locator('.tiptap h1').click();await page.keyboard.type('打印内容');await page.keyboard.press('Control+p');
 await expect.poll(()=>page.evaluate(()=>window.printRequested)).toBe(true);
 await page.emulateMedia({media:'print'});await expect(page.locator('#titlebar')).toBeHidden();await expect(page.locator('.tiptap h1')).toHaveText('打印内容');expect(await page.locator('.tiptap h1').evaluate(el=>getComputedStyle(el).color)).toBe('rgb(17, 17, 17)');
});
