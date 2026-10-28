import { test, expect } from '@playwright/test';
const long = '# Document\n\n'+Array.from({length:80},(_,n)=>`## Chapter ${n}\n\nParagraph content ${n}.`).join('\n\n');
async function open(page){await page.goto('/');await page.locator('#file-input').setInputFiles({name:'long.md',mimeType:'text/markdown',buffer:Buffer.from(long)});}
async function native(page){await page.addInitScript(()=>{window.actions=[];window.desktop={readState:async()=>({}),writeState:async()=>{},dirty:async()=>{},window:async action=>{window.actions.push(action);return{fullscreen:false,maximized:false};}};});}

test('only document content exposes a scrollbar; auxiliary regions still scroll',async({page})=>{
 await open(page);
 await expect.poll(()=>page.locator('#document-scrollbar').evaluate(el=>el.scrollHeight-el.clientHeight)).toBeGreaterThan(500);
 expect(await page.locator('#document-scrollbar').evaluate(el=>el.offsetWidth-el.clientWidth)).toBeGreaterThan(0);
 for(const selector of ['.page-scroll','#outline','.sidebar-content','.dialog-body','.context-menu']){
  for(const node of await page.locator(selector).all())expect(await node.evaluate(el=>getComputedStyle(el).scrollbarWidth)).toBe('none');
 }
 await page.locator('#outline').evaluate(el=>{el.scrollTop=400;});expect(await page.locator('#outline').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 await page.keyboard.press('Control+,');await page.locator('.settings-body').evaluate(el=>{el.scrollTop=el.scrollHeight;});
 await expect(page.locator('#register-association')).toBeInViewport();
 expect(await page.locator('.settings-body').evaluate(el=>el.offsetWidth-el.clientWidth)).toBe(0);
});

test('rightmost native scrollbar controls the document in preview and source modes',async({page})=>{
 await open(page);const bar=page.locator('#document-scrollbar');
 for(const source of [false,true]){
  if(source)await page.locator('#source').click();
  await expect(bar).toHaveAttribute('aria-controls',source?'source-editor':'editor');
  const panel=await page.locator('#outline-panel').boundingBox(),r=await bar.boundingBox();
  expect(r.x).toBeGreaterThanOrEqual(panel.x+panel.width-1);expect(r.x+r.width).toBe(page.viewportSize().width);
  await bar.hover();await page.mouse.wheel(0,400);
  const field=page.locator(source?'#source-editor':'.page-scroll');
  await expect.poll(()=>field.evaluate(el=>el.scrollTop)).toBeGreaterThan(100);
  await field.evaluate(el=>{el.scrollTop=750;});await expect.poll(()=>bar.evaluate(el=>el.scrollTop)).toBe(750);
  if(source){await page.keyboard.press('Control+,');await page.locator('#setting-font-size').fill('24');await page.locator('#close-settings').click();await expect.poll(async()=>await bar.evaluate(el=>el.scrollHeight)-await field.evaluate(el=>el.scrollHeight)).toBe(0);}
 }
 await page.locator('#toggle-outline').click();await expect(page.locator('#outline-panel')).toBeHidden();
 const r=await bar.boundingBox();expect(r.x+r.width).toBe(page.viewportSize().width);
});

test('floating controls stay inside content in fullscreen, maximized and expanded sidebars',async({page})=>{
 await native(page);await open(page);
 for(const state of [{fullscreen:true,maximized:false},{fullscreen:false,maximized:true},{fullscreen:false,maximized:false}]){
  await page.evaluate(state=>window.dispatchEvent(new CustomEvent('tekaku-window-state',{detail:state})),state);
  for(const expanded of [true,false]){
   await page.locator('#expand').click();await expect(page.locator('#expand')).toHaveAttribute('aria-expanded',String(expanded));
   await expect.poll(()=>page.locator('.sidebar-rail').evaluate(el=>Math.round(el.getBoundingClientRect().width))).toBe(expanded?232:0);
   const frame=await page.locator('.editor-surface').boundingBox();
   for(const selector of ['#expand','#source','#toggle-outline']){
    const button=page.locator(selector);await expect(button).toBeVisible();const r=await button.boundingBox();
    expect(r.x).toBeGreaterThan(frame.x);expect(r.x+r.width).toBeLessThan(frame.x+frame.width);expect(r.y+r.height).toBeLessThan(frame.y+frame.height);
    expect(await button.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el;})).toBe(true);
   }
  }
 }
 await expect(page.locator('#close-outline')).toHaveCount(0);
});

test('sidebar and outline visibly animate through intermediate widths, with a persistent off switch',async({page})=>{
 await page.goto('/');await expect(page.locator('body')).toHaveClass(/layout-ready/);
 for(const [button,rail,limit] of [['#expand','.sidebar-rail',232],['#toggle-outline','.outline-rail',220]]){
  const samples=await page.evaluate(async({button,rail})=>{const widths=[];document.querySelector(button).click();const start=performance.now();await new Promise(resolve=>{function frame(){widths.push(document.querySelector(rail).getBoundingClientRect().width);if(performance.now()-start>450)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);});return widths;},{button,rail});
  expect(samples.some(width=>width>1&&width<limit-1)).toBe(true);
 }
 await page.keyboard.press('Control+,');await page.locator('#panel-animations').uncheck();await page.locator('#close-settings').click();await page.reload();
 await expect(page.locator('body')).toHaveClass(/panels-static/);
});

test('actual mouse border drags use all native resize directions after restore',async({page})=>{
 await native(page);await page.goto('/');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('tekaku-window-state',{detail:{fullscreen:false,maximized:false}})));
 for(const edge of ['left','right','top','bottom','top-left','top-right','bottom-left','bottom-right']){
  const r=await page.locator(`[data-resize="${edge}"]`).boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+2,r.y+r.height/2+2);await page.mouse.up();
  await expect.poll(()=>page.evaluate(()=>window.actions)).toContain('resize-'+edge);
 }
 const title=await page.locator('.titlebar-drag-space').boundingBox();await page.mouse.move(title.x+title.width/2,title.y+title.height/2);await page.mouse.down();await page.mouse.move(title.x+title.width/2+20,title.y+title.height/2+10);await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>window.actions)).toContain('drag');
});

test('application icons use shared blue vectors in every skin, including block menu and toolbar',async({page})=>{
 await native(page);await page.goto('/');await page.keyboard.press('Control+,');
 await page.locator('#show-toolbar').check();
 for(const theme of ['slate','white','paper','sage','night']){
  await page.locator(`[data-theme-choice=${theme}]`).click();
  const colors=await page.locator('svg.app-icon').evaluateAll(nodes=>[...new Set(nodes.map(node=>getComputedStyle(node).color))]);
  expect(colors).toEqual([theme==='night'?'rgb(154, 175, 208)':'rgb(75, 101, 133)']);
 }
 await page.locator('#close-settings').click();await page.locator('.tiptap h1').click();await page.keyboard.press('Enter');await page.keyboard.type('/');
 await expect(page.locator('.block-icon>svg.app-icon')).toHaveCount(16);
 for(const node of await page.locator('.toolbar button').all())await expect(node.locator('svg.app-icon')).toHaveCount(1);
});
