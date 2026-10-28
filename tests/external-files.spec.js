import {test,expect} from '@playwright/test';
async function install(page,initial=[]){
 await page.addInitScript(initial=>{
  window.openQueue=[...initial];window.pulls=0;
  window.desktop={readState:async()=>({}),writeState:async()=>{},dirty:async()=>{},nextOpenFile:async()=>{window.pulls++;const item=window.openQueue.shift();if(item?.error)throw new Error(item.error);return item||null;}};
 },initial);
}
async function forward(page,files){await page.evaluate(files=>{window.openQueue.push(...files);window.dispatchEvent(new Event('tekaku-open-files'));},files);}
const doc=(name,content)=>({name,path:'C:\\Notes\\'+name,content});

test('all startup arguments open tabs in the original page and legacy startup is skipped',async({page})=>{
 await install(page,[doc('first.md','# First'),doc('中文 文件.md','# 中文')]);
 await page.addInitScript(()=>{window.desktop.initialFile=async()=>{throw new Error('legacy startup must not run');};});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.locator('.tab-select')).toHaveCount(2);await expect(page.locator('.tiptap h1')).toHaveText('中文');
 await expect(page.locator('#error-dialog')).toBeHidden();expect(errors).toEqual([]);expect(page.context().pages()).toHaveLength(1);
});

test('forwarded shell opens add tabs and an already open path preserves its unsaved edits',async({page})=>{
 await install(page,[doc('first.md','# First')]);await page.goto('/');await expect(page.locator('.tiptap h1')).toHaveText('First');
 await page.locator('#source').click();await page.locator('#source-editor').fill('# Keep my changes');
 await forward(page,[doc('second.md','# Second')]);await expect(page.locator('.tab-select')).toHaveCount(2);await expect(page.locator('.tiptap h1')).toHaveText('Second');
 await forward(page,[doc('first.md','# Old disk version')]);await expect(page.locator('#source-editor')).toHaveValue('# Keep my changes');
 await expect(page.locator('.tab-select')).toHaveCount(2);await expect(page.locator('#save-state')).toHaveText('未保存');expect(page.context().pages()).toHaveLength(1);
});

test('files received during a save confirmation wait without changing its active document',async({page})=>{
 await install(page,[doc('first.md','# First')]);await page.goto('/');await page.locator('.tiptap h1').click();await page.keyboard.type(' changed');
 await page.keyboard.press('Control+w');await expect(page.locator('#confirm-message')).toContainText('first.md');const pulls=await page.evaluate(()=>window.pulls);
 await forward(page,[doc('second.md','# Second')]);await page.waitForTimeout(100);
 expect(await page.evaluate(()=>window.pulls)).toBe(pulls);await expect(page.locator('#filename')).toHaveText('first.md');await expect(page.locator('#confirm-message')).toContainText('first.md');
 await page.locator('#confirm-cancel').click();await expect(page.locator('.tab-select')).toHaveCount(2);await expect(page.locator('.tiptap h1')).toHaveText('Second');
 await page.locator('.tab-select').first().click();await expect(page.locator('.tiptap h1')).toContainText('changed');
});

test('concurrent notifications are serialized and do not lose requests during an RPC',async({page})=>{
 await install(page);await page.addInitScript(()=>{let inFlight=0;window.maxInFlight=0;window.desktop.nextOpenFile=async()=>{inFlight++;window.maxInFlight=Math.max(window.maxInFlight,inFlight);await new Promise(resolve=>setTimeout(resolve,40));inFlight--;return window.openQueue.shift()||null;};});
 await page.goto('/');
 for(let n=0;n<5;n++)await forward(page,[doc(`${n}.md`,`# File ${n}`)]);
 await expect(page.locator('.tab-select')).toHaveCount(5);await expect(page.locator('.tiptap h1')).toHaveText('File 4');
 expect(await page.evaluate(()=>window.maxInFlight)).toBe(1);
});

test('a malformed or unreadable file shows an error and remaining requests resume after closing it',async({page})=>{
 await install(page,[{error:'文件不是 UTF-8 编码'},doc('good.md','# Good')]);await page.goto('/');
 await expect(page.locator('#error-dialog')).toBeVisible();await expect(page.locator('#error-message')).toContainText('UTF-8');
 await page.locator('#error-close').click();await expect(page.locator('.tiptap h1')).toHaveText('Good');await expect(page.locator('.tab-select')).toHaveCount(1);
});

test('activation without a file reuses the current tab and leaves content intact',async({page})=>{
 await install(page,[doc('first.md','# First')]);await page.goto('/');await expect(page.locator('.tiptap h1')).toHaveText('First');
 await forward(page,[]);await expect(page.locator('.tab-select')).toHaveCount(1);await expect(page.locator('.tiptap h1')).toHaveText('First');
});
