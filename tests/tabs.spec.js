import {test,expect} from '@playwright/test';
async function files(page,docs){await page.locator('#file-input').setInputFiles(docs.map(([name,content])=>({name,mimeType:'text/markdown',buffer:Buffer.from(content)})));}
async function source(page){if(await page.locator('#source').getAttribute('aria-pressed')!=='true')await page.locator('#source').click();}
const long = title => `# ${title}\n\n`+Array.from({length:70},(_,n)=>`## Section ${n}\n\nLong paragraph ${n}`).join('\n\n');

test('tabs preserve rich undo, selection and independent scroll without prompting on new/open',async({page})=>{
 await page.goto('/');await files(page,[['first.md',long('First')],['second.md',long('Second')]]);
 await expect(page.locator('.tab-select')).toHaveCount(2);
 await page.locator('.tab-select').first().click();await page.locator('.tiptap h1').click();await page.keyboard.press('End');await page.keyboard.type(' edited');
 await page.locator('.page-scroll').evaluate(el=>{el.scrollTop=850;});
 await page.locator('.tab-select').last().click();await expect(page.locator('.tiptap h1')).toHaveText('Second');
 await page.locator('.tab-select').first().click();await expect(page.locator('.tiptap h1')).toHaveText('First edited');
 expect(await page.locator('.page-scroll').evaluate(el=>el.scrollTop)).toBe(850);
 await page.locator('.tiptap').focus();await page.keyboard.press('Control+z');await expect(page.locator('.tiptap h1')).toHaveText('First');
 await page.keyboard.press('Control+n');await expect(page.locator('.tab-select')).toHaveCount(3);await expect(page.locator('#confirm-dialog')).toBeHidden();
});

test('source contents and all unsaved tabs recover after reload',async({page})=>{
 await page.goto('/');await files(page,[['first.md','# First'],['second.md','# Second']]);
 await source(page);await page.locator('#source-editor').fill('# Second raw\n\n**unfinished');
 await page.locator('.tab-select').first().click();await source(page);await page.locator('#source-editor').fill('# First raw\n\n- [ ] task');
 await page.locator('.tab-select').last().click();await expect(page.locator('#source-editor')).toHaveValue('# Second raw\n\n**unfinished');
 page.on('dialog',dialog=>dialog.accept());await page.reload();await expect(page.locator('.tab-select')).toHaveCount(2);
 await expect(page.locator('.tiptap h1')).toHaveText('Second raw');await page.locator('.tab-select').first().click();
 await expect(page.locator('.tiptap h1')).toHaveText('First raw');await expect(page.locator('#save-state')).toHaveText('未保存');
});

test('native multi-open and save always use the active tab path and preserve other dirty tabs',async({page})=>{
 await page.addInitScript(()=>{
  window.saves=[];window.dirtyCalls=[];window.desktop={readState:async()=>({}),writeState:async()=>{},dirty:async v=>window.dirtyCalls.push(v),
   openFiles:async()=>[{name:'note.md',path:'C:\\One\\note.md',content:'# One'},{name:'note.md',path:'C:\\Two\\note.md',content:'# Two'}],
   save:async data=>{window.saves.push(data);return {...data};}};
 });
 await page.goto('/');await page.keyboard.press('Control+o');await expect(page.locator('.tab-select')).toHaveCount(2);
 await source(page);await page.locator('#source-editor').fill('# Two dirty');
 await page.locator('.tab-select').first().click();await source(page);await page.locator('#source-editor').fill('# One saved');await page.keyboard.press('Control+s');
 await expect(page.locator('#save-state')).toHaveText('已保存');
 expect(await page.evaluate(()=>window.saves)).toEqual([{content:'# One saved',saveAs:false,path:'C:\\One\\note.md',name:'note.md'}]);
 expect(await page.evaluate(()=>window.dirtyCalls.at(-1))).toBe(true);
 await page.locator('.tab-select').last().click();await expect(page.locator('#source-editor')).toHaveValue('# Two dirty');
 await expect(page.locator('#save-state')).toHaveText('未保存');
});

test('reopening a native path focuses its dirty tab instead of replacing it',async({page})=>{
 await page.addInitScript(()=>{window.desktop={readState:async()=>({}),writeState:async()=>{},dirty:async()=>{},openFiles:async()=>[{name:'same.md',path:'C:\\Notes\\same.md',content:'# Original'}]};});
 await page.goto('/');await page.keyboard.press('Control+o');await source(page);await page.locator('#source-editor').fill('# Changed');
 await page.keyboard.press('Control+n');await page.keyboard.press('Control+o');
 await expect(page.locator('.tab-select')).toHaveCount(2);await expect(page.locator('#source-editor')).toHaveValue('# Changed');
});

test('closing a background dirty tab supports cancel, canceled save and discard without losing another tab',async({page})=>{
 await page.addInitScript(()=>{window.desktop={readState:async()=>({}),writeState:async()=>{},dirty:async()=>{},save:async()=>null};});
 await page.goto('/');await files(page,[['first.md','# First'],['second.md','# Second']]);await source(page);await page.locator('#source-editor').fill('# Keep second');
 await page.locator('.tab-select').first().click();await page.locator('.tab-close').last().click();await expect(page.locator('#confirm-message')).toContainText('second.md');
 await page.locator('#confirm-cancel').click();await expect(page.locator('.tab-select')).toHaveCount(2);
 await page.keyboard.press('Control+w');await page.locator('#confirm-save').click();await expect(page.locator('#confirm-dialog')).toBeHidden();await expect(page.locator('.tab-select')).toHaveCount(2);
 await page.keyboard.press('Control+w');await page.locator('#confirm-discard').click();await expect(page.locator('.tab-select')).toHaveCount(1);await expect(page.locator('.tiptap h1')).toHaveText('First');
});

test('application close reviews every dirty tab and cancel leaves all content open',async({page})=>{
 await page.addInitScript(()=>{window.actions=[];window.desktop={readState:async()=>({}),writeState:async()=>{},dirty:async()=>{},window:async action=>{window.actions.push(action);return {fullscreen:true,maximized:false};}};});
 await page.goto('/');await files(page,[['first.md','# First'],['second.md','# Second']]);await source(page);await page.locator('#source-editor').fill('# Second unsaved');
 await page.locator('.tab-select').first().click();await source(page);await page.locator('#source-editor').fill('# First unsaved');
 await page.evaluate(()=>window.dispatchEvent(new Event('tekaku-close-request')));await expect(page.locator('#confirm-message')).toContainText('first.md');await page.locator('#confirm-discard').click();
 await expect(page.locator('#confirm-message')).toContainText('second.md');await page.locator('#confirm-cancel').click();
 expect(await page.evaluate(()=>window.actions)).not.toContain('close-confirmed');await expect(page.locator('.tab-select')).toHaveCount(2);
 await page.locator('.tab-select').first().click();await expect(page.locator('#source-editor')).toHaveValue('# First unsaved');
 await page.evaluate(()=>window.dispatchEvent(new Event('tekaku-close-request')));await page.locator('#confirm-discard').click();await expect(page.locator('#confirm-message')).toContainText('second.md');await page.locator('#confirm-discard').click();
 await expect.poll(()=>page.evaluate(()=>window.actions)).toContain('close-confirmed');
});

test('full-screen controls remain clickable after resize, multiple tabs and opening both panels',async({page})=>{
 await page.addInitScript(()=>{window.desktop={readState:async()=>({}),writeState:async()=>{},dirty:async()=>{},window:async()=>({fullscreen:true,maximized:false})};});
 await page.goto('/');await files(page,Array.from({length:12},(_,n)=>[`a-very-long-document-name-${n}.md`,'# Title']));
 for(const size of [{width:720,height:500},{width:1366,height:768}]){
  await page.setViewportSize(size);
  for(const expanded of [true,false]){
   await page.locator('#expand').click();await expect(page.locator('#expand')).toHaveAttribute('aria-expanded',String(expanded));
   for(const selector of ['#expand','#source','#toggle-outline','#window-close']){
    const b=page.locator(selector);await expect(b).toBeInViewport();
    expect(await b.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el;})).toBe(true);
   }
   await page.locator('#source').click();await page.locator('#toggle-outline').click();
  }
 }
 expect(await page.locator('#app').evaluate(el=>getComputedStyle(el,'::after').content)).toBe('none');
});

test('relative image resolution is scoped to each tab even when filenames and references match',async({page})=>{
 await page.addInitScript(()=>{window.images=[];window.desktop={readState:async()=>({}),writeState:async()=>{},dirty:async()=>{},openFiles:async()=>['One','Two'].map(dir=>({name:'note.md',path:`C:\\${dir}\\note.md`,content:'# Image\n\n![pic](same.png)'})),resolveImages:async(refs,path)=>{window.images.push(path);return {};}};});
 await page.goto('/');await page.keyboard.press('Control+o');await expect(page.locator('.tab-select')).toHaveCount(2);
 await expect.poll(()=>page.evaluate(()=>window.images)).toContain('C:\\Two\\note.md');
 await page.locator('.tab-select').first().click();await expect.poll(()=>page.evaluate(()=>window.images.at(-1))).toBe('C:\\One\\note.md');
});
