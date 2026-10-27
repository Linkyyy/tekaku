import { test, expect } from '@playwright/test';
async function bridge(page,options={}){
 await page.addInitScript(options=>{
  window.calls=[];let docId='fresh',counter=0;
  window.TekakuNative={request:raw=>{const {id,action,data}=JSON.parse(raw);window.calls.push({action,data});let result=true;
   if(action==='ready'){const draft=JSON.parse(localStorage.getItem('mock-draft')||'null');docId=draft?.docId||'fresh';result={draft,docId,incoming:options.incoming||false};}
   if(action==='draft')localStorage.setItem('mock-draft',JSON.stringify(data));
   if(action==='open'||action==='incoming'){docId='file-'+(++counter);result={name:'手机笔记.md',content:'# 手机笔记\n\n```python\nprint("hello")\n```\n\n- [ ] 待办',bound:true,docId};}
   if(action==='save'||action==='saveAs'){
    if(data.docId!==docId){setTimeout(()=>window.__tekakuReply(id,null,'文档标识不匹配'),0);return;}
    result=options.cancelSave?null:{name:action==='saveAs'?data.name:'手机笔记.md',bound:true,docId};
   }
   if(action==='new'){docId='new-'+(++counter);result={name:'未命名.md',content:'',docId,bound:false};}
   if(action==='backup')result=null;
   setTimeout(()=>window.__tekakuReply(id,result,null),0);
  }};
 },options);
}
test('fresh app is minimal, touch sized and has no viewport overflow',async({page})=>{
 await bridge(page);const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
 await expect(page.locator('.tiptap h1')).toHaveAttribute('data-placeholder','请输入标题');await expect(page.locator('#file-status')).toHaveText('本机草稿');
 for(const width of [320,393,768]){await page.setViewportSize({width,height:851});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 expect(await page.locator('#save-file').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);expect(errors).toEqual([]);
});
test('native open, code editing, language and save preserve Markdown',async({page})=>{
 await bridge(page);await page.goto('/');await page.locator('#open-file').click();await expect(page.locator('.tiptap h1')).toHaveText('手机笔记');
 await page.locator('.tiptap pre').click();await expect(page.locator('#language')).toHaveValue('python');await page.locator('#language').selectOption('javascript');
 await page.locator('.tiptap input[type=checkbox]').check();await page.locator('#save-file').click();
 await expect(page.locator('#file-status')).toHaveText('已保存到文件');
 const saved=await page.evaluate(()=>window.calls.findLast(x=>x.action==='save').data);expect(saved.content).toContain('```javascript');expect(saved.content).toContain('- [x] 待办');expect(saved.docId).toBe('file-1');
});
test('canceling save keeps the current file and prevents an open action',async({page})=>{
 await bridge(page,{cancelSave:true});await page.goto('/');await page.locator('.tiptap h1').click();await page.keyboard.type('保留');
 await page.locator('#open-file').click();await page.locator('#save-change').click();await expect(page.locator('#save-change')).toBeEnabled();await expect(page.locator('#confirm-dialog')).toBeVisible();
 await page.locator('#cancel-change').click();await expect(page.locator('.tiptap h1')).toHaveText('保留');expect(await page.evaluate(()=>window.calls.filter(x=>x.action==='open').length)).toBe(0);
});
test('source edits, skin and unsaved draft restore after restarting the view',async({page})=>{
 await bridge(page);await page.goto('/');await page.locator('#more').click();await page.locator('#theme').selectOption('night');await page.locator('#toggle-source').click();
 await page.locator('#source').fill('# 草稿\n\n```cpp\nint main() { return 0; }\n```');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mock-draft')||'null')?.content)).toContain('int main');
 await page.reload();await expect(page.locator('body')).toHaveAttribute('data-theme','night');await expect(page.locator('#source')).toHaveValue(/# 草稿/);await expect(page.locator('#file-status')).toHaveText('修改未保存');
 await page.locator('#more').click();await page.locator('#toggle-source').click();await expect(page.locator('.tiptap pre code')).toHaveText('int main() { return 0; }');
});
test('new document gets a fresh save token and Save As uses the requested filename',async({page})=>{
 await bridge(page);await page.goto('/');await page.locator('#more').click();await page.locator('#new-document').click();
 await page.locator('.tiptap h1').click();await page.keyboard.type('new document');await page.locator('#more').click();await page.locator('#save-as').click();
 await page.locator('#rename-input').fill('新笔记');await page.locator('#rename-form .primary').click();await expect(page.locator('#file-name')).toHaveText('新笔记.md');
 const saved=await page.evaluate(()=>window.calls.findLast(x=>x.action==='saveAs').data);expect(saved.docId).toBe('new-1');expect(saved.name).toBe('新笔记.md');
});
test('incoming files wait for a discard decision and hardware back closes the menu first',async({page})=>{
 await bridge(page);await page.goto('/');await page.locator('.tiptap h1').click();await page.keyboard.type('local draft');
 await page.evaluate(()=>window.__tekakuIncoming());await expect(page.locator('#confirm-dialog')).toBeVisible();await page.locator('#discard-change').click();await expect(page.locator('.tiptap h1')).toHaveText('手机笔记');
 await page.locator('#more').click();await page.evaluate(()=>window.__tekakuBack());await expect(page.locator('#menu-dialog')).not.toBeVisible();expect(await page.evaluate(()=>window.calls.filter(x=>x.action==='exit').length)).toBe(0);
});
