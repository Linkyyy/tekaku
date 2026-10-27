import { test, expect } from '@playwright/test';
async function drop(page,files){await page.evaluate(files=>{const data=new DataTransfer();for(const file of files)data.items.add(new File([Uint8Array.from(file.bytes)],file.name,{type:file.type||'text/markdown'}));document.querySelector('#app').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));},files.map(file=>({...file,bytes:[...Buffer.from(file.content)]})));}
test('all window borders start native resize and fullscreen hides the handles',async({page})=>{
 await page.addInitScript(()=>{window.actions=[];window.desktop={readState:async()=>({}),writeState:async()=>{},dirty:async()=>{},window:async action=>{window.actions.push(action);return {fullscreen:action==='fullscreen',maximized:false};}};});
 await page.goto('/');await expect(page.locator('.resize-handle')).toHaveCount(8);
 for(const edge of ['left','right','top','bottom','top-left','top-right','bottom-left','bottom-right']){
  await page.locator(`[data-resize="${edge}"]`).dispatchEvent('pointerdown',{button:0});
  await expect.poll(()=>page.evaluate(()=>window.actions)).toContain('resize-'+edge);
 }
 await page.keyboard.press('F11');await expect(page.locator('[data-resize=left]')).toBeHidden();
});
test('dropping Markdown opens it after confirmation and clears a previous native save target',async({page})=>{
 await page.addInitScript(()=>{window.imported=[];window.states={};window.desktop={readState:async()=>({}),writeState:async(k,v)=>{window.states[k]=v;},dirty:async()=>{},initialFile:async()=>({name:'old.md',path:'C:\\old.md',content:'# Old'}),importFile:async data=>{window.imported.push(data);return {...data,path:''};}};});
 await page.goto('/');await expect(page.locator('.tiptap h1')).toHaveText('Old');await page.locator('.tiptap h1').click();await page.keyboard.type(' changed');
 await drop(page,[{name:'新文件.MD',content:'# 新文件\n\n```js\nconst x = 1;\n```'}]);await expect(page.locator('#confirm-dialog')).toBeVisible();await page.locator('#confirm-cancel').click();
 await expect(page.locator('.tiptap h1')).toContainText('Old');expect(await page.evaluate(()=>window.imported.length)).toBe(0);
 await drop(page,[{name:'新文件.MD',content:'# 新文件\n\n```js\nconst x = 1;\n```'}]);await page.locator('#confirm-discard').click();await expect(page.locator('#filename')).toHaveText('新文件.MD');await expect(page.locator('.tiptap pre code')).toHaveText('const x = 1;');
 expect(await page.evaluate(()=>JSON.parse(window.states['tekaku-draft']).path)).toBeNull();expect(await page.evaluate(()=>window.imported.length)).toBe(1);
});
test('multiple Markdown files and invalid UTF-8 do not replace the current document',async({page})=>{
 await page.goto('/');await drop(page,[{name:'first.md',content:'# First'},{name:'second.md',content:'# Second'}]);await expect(page.locator('#filename')).toHaveText('未命名.md');
 await page.evaluate(()=>{const data=new DataTransfer();data.items.add(new File([new Uint8Array([0xff,0xfe,0xff])],'bad.md',{type:'text/markdown'}));document.querySelector('#app').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));});
 await expect(page.locator('#error-dialog')).toBeVisible();await expect(page.locator('#filename')).toHaveText('未命名.md');
});
