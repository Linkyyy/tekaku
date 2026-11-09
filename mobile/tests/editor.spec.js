import {test,expect} from '@playwright/test';
const content=title=>`# ${title}\n\n- [ ] 待办\n\n\`\`\`python\nprint("hello")\n\`\`\``;
async function bridge(page,options={}){
 await page.addInitScript(options=>{
  window.calls=[];window.saveTargets=[];window.nativeBindings=new Map();let sequence=0;
  const allocate=(data={},prefix='file')=>{let docId=data.docId;if(!docId){do{docId=prefix+'-'+(++sequence);}while(window.nativeBindings.has(docId));}const doc={name:data.name||'手机笔记.md',content:data.content||'',bound:data.bound!==false,docId};window.nativeBindings.set(docId,doc);return doc;};
  window.openBatches=[(options.documents||[{name:'手机笔记.md',content:'# 手机笔记\n\n```python\nprint("hello")\n```\n\n- [ ] 待办'}])];window.incomingDocs=[];
  window.TekakuNative={request:raw=>{const {id,action,data}=JSON.parse(raw);window.calls.push({action,data});let result=true,error=null;
   if(action==='ready'){const draft=JSON.parse(localStorage.getItem('mock-draft')||'null');window.nativeBindings.clear();if(draft){for(const doc of draft.tabs||[draft])allocate(doc);}else allocate({name:'未命名.md',content:'',docId:'fresh',bound:false});result={draft,docId:draft?.docId||'fresh',incoming:window.incomingDocs.length>0};}
   if(action==='draft'){if((data.tabs||[data]).some(doc=>!window.nativeBindings.has(doc.docId)))error='文档标识不匹配';else localStorage.setItem('mock-draft',JSON.stringify(data));}
   if(action==='open')result=(window.openBatches.shift()||[]).map(doc=>allocate(doc));
   if(action==='incoming'){const item=window.incomingDocs.shift();result=item?allocate(item):null;}
   if(action==='save'||action==='saveAs'){
    const target=window.nativeBindings.get(data.docId);if(!target)error='文档标识不匹配';else if(options.cancelSave)result=null;else{window.saveTargets.push(data.docId);Object.assign(target,{content:data.content,bound:true,name:action==='saveAs'?data.name:target.name});result={...target};}
   }
   if(action==='new')result=allocate({name:'未命名.md',content:'',bound:false},'new');
   if(action==='close')window.nativeBindings.delete(data.docId);
   if(action==='backup')result=null;
   setTimeout(()=>window.__tekakuReply(id,error?null:result,error),0);
  }};
 },options);
}
async function edit(page){if(await page.locator('#toggle-editing').getAttribute('aria-pressed')!=='true')await page.locator('#toggle-editing').click();}
async function selectTab(page,index){await page.locator('#toggle-documents').click();await page.locator('.tab-select').nth(index).click();await page.locator('#documents-drawer').waitFor({state:'hidden'});}
async function source(page){await page.locator('#more').click();await page.locator('#toggle-source').click();}
const docs=[{name:'第一.md',content:content('First')},{name:'第二.md',content:content('Second')}];

test('fresh app is minimal, touch sized and has no viewport overflow',async({page})=>{
 await bridge(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.locator('.tiptap h1')).toHaveAttribute('data-placeholder','请输入标题');await expect(page.locator('#file-status')).toContainText('本机草稿');
 for(const width of [320,393,768]){await page.setViewportSize({width,height:851});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 for(const id of ['save-file','toggle-editing','toggle-documents'])expect(await page.locator('#'+id).evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);expect(errors).toEqual([]);
});
test('opened file reads first; only explicit editing enables code, tasks and save',async({page})=>{
 await bridge(page);await page.goto('/');await page.locator('#open-file').click();await expect(page.locator('.tiptap h1')).toHaveText('手机笔记');await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','false');await expect(page.locator('#format-bar')).toBeHidden();await expect(page.locator('.tiptap input[type=checkbox]')).toBeDisabled();
 await edit(page);await page.locator('.tiptap pre').click();await expect(page.locator('#language')).toHaveValue('python');await page.locator('#language').selectOption('javascript');await page.locator('.tiptap input[type=checkbox]').check();await page.locator('#save-file').click();await expect(page.locator('#file-status')).toContainText('已保存到文件');
 const saved=await page.evaluate(()=>window.calls.findLast(x=>x.action==='save').data);expect(saved.content).toContain('```javascript');expect(saved.content).toContain('- [x] 待办');expect(saved.docId).toBe('file-1');
});
test('multiple files live in the drawer; new document is a new editable tab',async({page})=>{
 await bridge(page,{documents:docs});await page.goto('/');await page.locator('#open-file').click();await expect(page.locator('#document-count')).toHaveText('2');await page.locator('#toggle-documents').click();await expect(page.locator('.tab-select')).toHaveCount(2);await page.locator('#drawer-new').click();await page.locator('#documents-drawer').waitFor({state:'hidden'});await expect(page.locator('#document-count')).toHaveText('3');await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','true');await expect(page.locator('.tiptap h1')).toHaveAttribute('data-placeholder','请输入标题');
});
test('tab switching preserves dirty text and native save targets each document token',async({page})=>{
 await bridge(page,{documents:docs});await page.goto('/');await page.locator('#open-file').click();await edit(page);await source(page);await page.locator('#source').fill('# Second dirty');await selectTab(page,0);await expect(page.locator('.tiptap h1')).toHaveText('First');await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','false');
 await edit(page);await source(page);await page.locator('#source').fill('# First saved');await page.locator('#save-file').click();await expect(page.locator('#file-status')).toContainText('已保存到文件');expect(await page.evaluate(()=>window.saveTargets)).toEqual(['file-1']);
 await selectTab(page,1);await expect(page.locator('#source')).toHaveValue('# Second dirty');await expect(page.locator('#file-status')).toContainText('修改未保存');await page.locator('#save-file').click();await expect.poll(()=>page.evaluate(()=>window.saveTargets)).toEqual(['file-1','file-2']);
});
test('closing a dirty tab supports cancel and canceled save without losing any tab',async({page})=>{
 await bridge(page,{documents:docs,cancelSave:true});await page.goto('/');await page.locator('#open-file').click();await edit(page);await source(page);await page.locator('#source').fill('# Keep this');await page.locator('#toggle-documents').click();await page.locator('.tab-close').nth(1).click();await expect(page.locator('#confirm-message')).toContainText('第二.md');await page.locator('#cancel-change').click();await expect(page.locator('#document-count')).toHaveText('2');await expect(page.locator('#source')).toHaveValue('# Keep this');
 await page.locator('#documents-drawer').waitFor({state:'hidden'});await page.locator('#toggle-documents').click();await page.locator('.tab-close').nth(1).click();await page.locator('#save-change').click();await expect(page.locator('#confirm-dialog')).toBeHidden();await expect(page.locator('#document-count')).toHaveText('2');
 await page.locator('#documents-drawer').waitFor({state:'hidden'});await page.locator('#toggle-documents').click();await page.locator('.tab-close').nth(1).click();await page.locator('#discard-change').click();await expect(page.locator('#document-count')).toHaveText('1');await expect(page.locator('.tiptap h1')).toHaveText('First');
});
test('all drafts and theme restore in reading mode after reload',async({page})=>{
 await bridge(page,{documents:docs});await page.goto('/');await page.locator('#open-file').click();await edit(page);await source(page);await page.locator('#source').fill('# Second raw\n\nunfinished **');await selectTab(page,0);await edit(page);await source(page);await page.locator('#source').fill('# First raw');await page.locator('#more').click();await page.locator('#theme').selectOption('night');await page.locator('[data-close=menu-dialog]').click();await page.evaluate(()=>window.mobileEditor.flushDraft());
 await page.reload();await expect(page.locator('#document-count')).toHaveText('2');await expect(page.locator('body')).toHaveAttribute('data-theme','night');await expect(page.locator('.tiptap h1')).toHaveText('First raw');await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','false');await expect(page.locator('#file-status')).toContainText('修改未保存');await selectTab(page,1);await expect(page.locator('.tiptap h1')).toHaveText('Second raw');await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','false');
});
test('reopening an existing native document focuses its tab without overwriting edits',async({page})=>{
 await bridge(page,{documents:docs});await page.goto('/');await page.locator('#open-file').click();await selectTab(page,0);await edit(page);await source(page);await page.locator('#source').fill('# Keep First');await selectTab(page,1);
 await page.evaluate(()=>window.openBatches.push([{name:'第一.md',content:'# Old disk version',docId:'file-1'}]));await page.locator('#open-file').click();await expect(page.locator('#document-count')).toHaveText('2');await expect(page.locator('#source')).toHaveValue('# Keep First');
});
test('incoming files add tabs without discarding drafts; back closes the drawer first',async({page})=>{
 await bridge(page);await page.goto('/');await page.locator('.tiptap h1').click();await page.keyboard.type('local draft');await page.evaluate(()=>{window.incomingDocs.push({name:'incoming.md',content:'# Incoming'});window.__tekakuIncoming();});await expect(page.locator('.tiptap h1')).toHaveText('Incoming');await expect(page.locator('#document-count')).toHaveText('2');await expect(page.locator('#confirm-dialog')).toBeHidden();await selectTab(page,0);await expect(page.locator('.tiptap h1')).toHaveText('local draft');
 await page.locator('#toggle-documents').click();await page.evaluate(()=>window.__tekakuBack());await page.locator('#documents-drawer').waitFor({state:'hidden'});expect(await page.evaluate(()=>window.calls.filter(x=>x.action==='exit').length)).toBe(0);
});
test('Save As renames only the selected tab and keeps its document token',async({page})=>{
 await bridge(page,{documents:docs});await page.goto('/');await page.locator('#open-file').click();await selectTab(page,0);await page.locator('#more').click();await page.locator('#save-as').click();await page.locator('#rename-input').fill('新笔记');await page.locator('#rename-form .primary').click();await expect(page.locator('#file-name')).toHaveText('新笔记.md');const saved=await page.evaluate(()=>window.calls.findLast(x=>x.action==='saveAs').data);expect(saved.docId).toBe('file-1');expect(saved.name).toBe('新笔记.md');await selectTab(page,1);await expect(page.locator('#file-name')).toHaveText('第二.md');
});
test('read-only source and editing shortcuts cannot alter an opened file',async({page})=>{
 await bridge(page);await page.goto('/');await page.locator('#open-file').click();await page.locator('.tiptap h1').click();await page.keyboard.press('End');await page.keyboard.type('blocked');await page.keyboard.press('Control+b');await expect(page.locator('.tiptap h1')).toHaveText('手机笔记');await source(page);await expect(page.locator('#source')).toHaveJSProperty('readOnly',true);const before=await page.locator('#source').inputValue();await page.locator('#source').focus();await page.keyboard.press('Tab');await page.keyboard.type('blocked');expect(await page.locator('#source').inputValue()).toBe(before);await expect(page.locator('#file-status')).not.toContainText('未保存');await page.keyboard.press('Control+s');expect(await page.evaluate(()=>window.calls.filter(x=>x.action==='save').length)).toBe(0);
});
test('only one empty paragraph carries the hint and reading hides it',async({page})=>{
 await page.goto('/');await page.locator('.tiptap h1').click();await page.keyboard.type('Title');for(let n=0;n<4;n++)await page.keyboard.press('Enter');await expect(page.locator('.tiptap [data-placeholder="开始写点什么…"]')).toHaveCount(1);await page.locator('#toggle-editing').click();await expect(page.locator('.tiptap [data-placeholder]')).toHaveCount(0);
});
test('hardware back reviews dirty tabs, cancel preserves all, discard does not recover abandoned changes',async({page})=>{
 await bridge(page,{documents:docs});await page.goto('/');await page.locator('#open-file').click();await edit(page);await source(page);await page.locator('#source').fill('# Abandoned second');await selectTab(page,0);await edit(page);await source(page);await page.locator('#source').fill('# Keep first');
 await page.evaluate(()=>{window.__tekakuBack();});await expect(page.locator('#confirm-message')).toContainText('第一.md');await page.locator('#discard-change').click();await expect(page.locator('#confirm-message')).toContainText('第二.md');await page.locator('#cancel-change').click();expect(await page.evaluate(()=>window.calls.filter(x=>x.action==='exit').length)).toBe(0);await selectTab(page,0);await expect(page.locator('#source')).toHaveValue('# Keep first');
 await page.evaluate(()=>{window.__tekakuBack();});await page.locator('#discard-change').click();await expect(page.locator('#confirm-message')).toContainText('第二.md');await page.locator('#discard-change').click();await expect.poll(()=>page.evaluate(()=>window.calls.filter(x=>x.action==='exit').length)).toBe(1);expect(await page.evaluate(()=>localStorage.getItem('mock-draft'))).not.toContain('Abandoned second');
});
