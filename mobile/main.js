import { Editor } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from '@tiptap/markdown';
import { extraExtensions } from '../src/editor-extensions';
import { documentPlaceholder, installReadOnlyGuard } from '../src/reading-mode';
import { icon } from '../src/icons';
import { codeLanguages, languageName } from '../src/code-languages';
import { indentSource } from '../src/editing';
import './style.css';

const $ = selector => document.querySelector(selector);
const native = Boolean(window.TekakuNative?.request);
const callbacks = new Map();let sequence=0;
window.__tekakuReply = (id,result,error) => {
  const callback=callbacks.get(id);if(!callback)return;callbacks.delete(id);
  if(error)callback.reject(new Error(error));else callback.resolve(result);
};
function call(action,data={}) {
  return new Promise((resolve,reject)=>{
    const id=String(++sequence);callbacks.set(id,{resolve,reject});
    try{window.TekakuNative.request(JSON.stringify({id,action,data}));}catch(error){callbacks.delete(id);reject(error);}
  });
}
$('#mobile').innerHTML=`
 <header><button id="toggle-documents" aria-label="打开文档抽屉" aria-haspopup="dialog" aria-controls="documents-drawer">${icon('panel')}<span id="document-count">1</span></button><div class="file-info"><strong id="file-name">未命名.md</strong><span id="file-status" role="status">本机草稿</span></div><button id="toggle-editing" class="mode-button" aria-label="进入编辑模式" aria-pressed="false">编辑</button><button id="open-file" aria-label="打开 Markdown" title="打开">${icon('open')}</button><button id="save-file" aria-label="保存文档" title="保存">${icon('save')}</button><button id="more" aria-label="更多">${icon('chevron')}</button></header>
 <div id="code-context" hidden><label>语言<select id="language" aria-label="代码语言">${codeLanguages.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><button id="copy-code">复制</button><button id="indent-code" aria-label="增加代码缩进">⇥</button></div>
 <main id="document-scroll" role="tabpanel" aria-label="当前文档"><div id="editor"></div><textarea id="source" aria-label="Markdown 源码" spellcheck="false" hidden></textarea></main>
 <nav id="format-bar" aria-label="编辑工具"><button data-format="heading" aria-label="标题">H<span>₂</span></button><button data-format="bold" aria-label="粗体">${icon('bold')}</button><button data-format="italic" aria-label="斜体">${icon('italic')}</button><button data-format="codeBlock" aria-label="代码块">${icon('code')}</button><button data-format="bulletList" aria-label="列表">${icon('bulletList')}</button><button data-format="undo" aria-label="撤销">${icon('undo')}</button><button id="insert" aria-label="插入内容">${icon('plus')}</button></nav>
 <dialog id="documents-drawer" class="drawer" aria-labelledby="documents-title"><div class="drawer-heading"><div><span class="drawer-eyebrow">TEKAKU</span><h2 id="documents-title">文档</h2></div><button id="close-documents" aria-label="关闭文档抽屉">${icon('close')}</button></div><div class="drawer-actions"><button id="drawer-new">${icon('plus')}新建</button><button id="drawer-open">${icon('open')}打开</button></div><nav id="document-tabs" role="tablist" aria-label="打开的文档" aria-orientation="vertical"></nav><p class="drawer-note">每份文档独立保存，修改保留在各自标签中。</p></dialog>
 <dialog id="menu-dialog" class="sheet" aria-labelledby="menu-title"><div class="sheet-heading"><h2 id="menu-title">文档</h2><button data-close="menu-dialog" aria-label="关闭菜单">${icon('close')}</button></div><button class="menu-row" id="new-document">新建文档<span>＋</span></button><button class="menu-row" id="save-as">另存为<span>↗</span></button><button class="menu-row" id="toggle-source">Markdown 源码<span id="source-label">切换</span></button><button class="menu-row" id="recover-backup">恢复上次写入前的副本<span>↶</span></button><label class="menu-row">皮肤<select id="theme" aria-label="皮肤"><option value="white">纯白</option><option value="paper">纸笺</option><option value="sage">青苔</option><option value="night">深夜</option></select></label><p class="menu-note">手书 Android 0.2.0 · 文档与草稿保存在本机<br>网络图片会访问对应地址。相对路径图片需重新选择插入。</p></dialog>
 <dialog id="insert-dialog" class="sheet" aria-labelledby="insert-title"><div class="sheet-heading"><h2 id="insert-title">插入</h2><button data-close="insert-dialog" aria-label="关闭插入菜单">${icon('close')}</button></div><div class="insert-grid">${[['paragraph','正文'],['h1','一级标题'],['h2','二级标题'],['h3','三级标题'],['h4','四级标题'],['h5','五级标题'],['h6','六级标题'],['taskList','待办清单'],['orderedList','有序列表'],['blockquote','引用'],['code','行内代码'],['codeBlock','代码块'],['table','表格'],['image','本地图片'],['link','链接'],['horizontalRule','分割线']].map(([id,label])=>`<button data-insert="${id}">${label}</button>`).join('')}</div></dialog>
 <dialog id="confirm-dialog" class="message-dialog" aria-labelledby="confirm-title"><h2 id="confirm-title">保存修改？</h2><p id="confirm-message"></p><div class="dialog-actions"><button id="cancel-change">取消</button><button id="discard-change">不保存</button><button id="save-change" class="primary">保存</button></div></dialog>
 <dialog id="error-dialog" class="message-dialog" aria-labelledby="error-title"><h2 id="error-title">操作失败</h2><p id="error-text"></p><div class="dialog-actions"><button data-close="error-dialog" class="primary">知道了</button></div></dialog>
 <dialog id="link-dialog" class="message-dialog" aria-labelledby="link-title"><h2 id="link-title">插入链接</h2><form id="link-form"><label>链接文字<input id="link-text"></label><label>地址<input id="link-url" type="url" placeholder="https://example.com" required></label><div class="dialog-actions"><button type="button" data-close="link-dialog">取消</button><button class="primary">插入</button></div></form></dialog>
 <dialog id="rename-dialog" class="message-dialog" aria-labelledby="rename-title"><h2 id="rename-title">另存为</h2><form id="rename-form"><label>文件名<input id="rename-input" required maxlength="120"></label><div class="dialog-actions"><button type="button" data-close="rename-dialog">取消</button><button class="primary">继续</button></div></form></dialog>
 <input id="file-input" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" multiple hidden><input id="image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden><div id="toast" role="status"></div>`;

let counter=0,sourceMode=false,sourceBefore='',theme='white',busy=false,changing=false,incoming=false,ready=false;
let draftTimer,toastTimer,draftChain=Promise.resolve();
const blank={type:'doc',content:[{type:'heading',attrs:{level:1}},{type:'paragraph'}]};
function makeTab(data={},editing=false){return {id:++counter,docId:data.docId||'',name:data.name||'未命名.md',bound:Boolean(data.bound),content:typeof data.content==='string'?data.content:null,dirty:Boolean(data.dirty),editing,state:null,mode:false,scroll:0,sourceScroll:0,sourceBefore:'',richChanged:false,revision:0};}
let tabs=[makeTab({},true)],active=tabs[0];
const editor=new Editor({
 element:$('#editor'),extensions:[StarterKit.configure({codeBlock:false,undoRedo:{depth:30},link:{openOnClick:false}}),documentPlaceholder(),TaskList,TaskItem.configure({nested:true}),...extraExtensions,Markdown],
 content:blank,editorProps:{attributes:{'aria-label':'文档编辑器',spellcheck:'false'}},
 onUpdate(){if(changing)return;active.dirty=true;active.richChanged=true;active.revision++;sync();scheduleDraft();},onSelectionUpdate(){context();},
});
installReadOnlyGuard(editor,$('#source'));
function markdown(){return sourceMode?$('#source').value:active.richChanged||active.content===null?editor.getMarkdown():active.content;}
function capture(){Object.assign(active,{content:markdown(),state:editor.state,mode:sourceMode,sourceBefore,scroll:$('#document-scroll').scrollTop,sourceScroll:$('#source').scrollTop,sourceSelection:[$('#source').selectionStart,$('#source').selectionEnd]});}
function session(){capture();return {...record(active),theme,activeIndex:tabs.indexOf(active),tabs:tabs.map(record)};}
function record(tab){return {name:tab.name,docId:tab.docId,bound:tab.bound,content:tab.content??'',dirty:tab.dirty};}
function scheduleDraft(){if(!ready)return;clearTimeout(draftTimer);draftTimer=setTimeout(flushDraft,550);}
function flushDraft(){
 clearTimeout(draftTimer);if(!ready)return draftChain;
 const data=session();draftChain=draftChain.catch(()=>{}).then(()=>native?call('draft',data):localStorage.setItem('tekaku-mobile-draft',JSON.stringify(data))).catch(()=>{toast('草稿未能写入，请保存到文件');});return draftChain;
}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2500);}
function error(reason){$('#error-text').textContent=reason?.message||String(reason);if(!$('#error-dialog').open)$('#error-dialog').showModal();}
function renderTabs(){
 const list=$('#document-tabs');
 for(const row of list.querySelectorAll('[data-tab-id]'))if(!tabs.some(tab=>tab.id===Number(row.dataset.tabId)))row.remove();
 for(const tab of tabs){
  let row=list.querySelector(`[data-tab-id="${tab.id}"]`);
  if(!row){row=document.createElement('div');row.className='document-tab';row.dataset.tabId=tab.id;
   const select=document.createElement('button');select.className='tab-select';select.setAttribute('role','tab');select.setAttribute('aria-controls','document-scroll');select.innerHTML=icon('document')+'<span class="tab-caption"><strong></strong><small></small></span><span class="tab-dirty" aria-hidden="true"></span>';select.onclick=()=>{if(!busy){activate(tab);closeDrawer();}};
   const close=document.createElement('button');close.className='tab-close';close.innerHTML=icon('close');close.onclick=()=>{closeDrawer();run(()=>closeTab(tab));};row.append(select,close);list.append(row);
  }
  row.classList.toggle('selected',tab===active);const select=row.querySelector('.tab-select');select.setAttribute('aria-selected',String(tab===active));select.disabled=busy;
  row.querySelector('strong').textContent=tab.name;row.querySelector('small').textContent=(tab.editing?'编辑':'阅读')+' · '+(tab.dirty?'未保存':tab.bound?'已保存':'本机草稿');row.querySelector('.tab-dirty').textContent=tab.dirty?'•':'';
  const close=row.querySelector('.tab-close');close.disabled=busy;close.setAttribute('aria-label','关闭 '+tab.name);
 }
 $('#document-count').textContent=String(tabs.length);$('#toggle-documents').setAttribute('aria-label',`打开文档抽屉，${tabs.length} 个标签`);
}
function sync(){
 $('#file-name').textContent=active.name;$('#file-status').textContent=busy?'正在处理…':(active.editing?'编辑':'阅读')+' · '+(active.dirty?'修改未保存':active.bound?'已保存到文件':'本机草稿');
 const editable=active.editing&&!busy;if(editor.isEditable!==editable)editor.setEditable(editable,false);
 document.body.classList.toggle('is-reading',!active.editing);$('#source').readOnly=!active.editing;$('#source').disabled=busy;
 $('#toggle-editing').textContent=active.editing?'阅读':'编辑';$('#toggle-editing').setAttribute('aria-label',active.editing?'切换阅读模式':'进入编辑模式');$('#toggle-editing').setAttribute('aria-pressed',String(active.editing));
 for(const button of document.querySelectorAll('header button, #format-bar button, .drawer-actions button'))button.disabled=busy;
 for(const checkbox of document.querySelectorAll('.tiptap input[type=checkbox]'))checkbox.disabled=!editable;
 document.title=active.name+' · 手书';renderTabs();context();
}
function context(){
 const code=active.editing&&!sourceMode&&editor.isActive('codeBlock');$('#code-context').hidden=!code;
 if(code){const language=editor.getAttributes('codeBlock').language||'plaintext',canonical=languageName(language),select=$('#language');if(![...select.options].some(x=>x.value===canonical)){const option=document.createElement('option');option.value=canonical;option.textContent=language+'（纯文本）';select.append(option);}select.value=canonical;}
 for(const button of document.querySelectorAll('[data-format]'))button.setAttribute('aria-pressed',String(!sourceMode&&editor.isActive(button.dataset.format==='heading'?'heading':button.dataset.format)));
 $('#source-label').textContent=sourceMode?'排版视图':'切换';
}
function setTheme(value){theme=['white','paper','sage','night'].includes(value)?value:'white';document.body.dataset.theme=theme;$('#theme').value=theme;scheduleDraft();if(native)call('theme',{value:theme}).catch(()=>{});}
function replace(content){editor.commands.setContent(content===null?blank:content,{contentType:content===null?'json':'markdown',emitUpdate:false});const state=editor.state;editor.view.updateState(EditorState.create({schema:state.schema,doc:state.doc,plugins:state.plugins}));}
function activate(tab){
 if(tab===active){sync();return;}
 capture();changing=true;
 try{active=tab;if(tab.state)editor.view.updateState(tab.state);else replace(tab.content);
  sourceMode=tab.mode;sourceBefore=tab.sourceBefore;$('#source').value=sourceMode?tab.content:'';$('#source').hidden=!sourceMode;$('#editor').hidden=sourceMode;
  if(tab.sourceSelection)$('#source').setSelectionRange(...tab.sourceSelection);sync();$('#document-scroll').scrollTop=tab.scroll;$('#source').scrollTop=tab.sourceScroll;
 }finally{changing=false;}
 scheduleDraft();
}
function load(data,editing=false){
 if(!data)return;
 const existing=data.docId&&tabs.find(tab=>tab.docId===data.docId);if(existing){activate(existing);return;}
 const unused=tabs.length===1&&!active.dirty&&!active.bound&&editor.isEmpty&&!sourceMode,old=active;
 const tab=makeTab(data,editing);tabs.push(tab);activate(tab);
 if(unused){tabs=tabs.filter(tab=>tab!==old);if(native&&old.docId)flushDraft().then(()=>call('close',{docId:old.docId})).catch(()=>{});renderTabs();}
 scheduleDraft();
}
function setSource(value){
 if(value===sourceMode)return;
 if(value){sourceBefore=markdown();$('#source').value=sourceBefore;}
 else{const content=$('#source').value;if(content!==sourceBefore){active.content=content;active.richChanged=false;editor.commands.setContent(content,{contentType:'markdown',emitUpdate:false});}$('#source').value='';sourceBefore='';}
 sourceMode=value;$('#source').hidden=!value;$('#editor').hidden=value;sync();scheduleDraft();
}
$('#toggle-editing').onclick=()=>{if(busy)return;const scroll=$('#document-scroll').scrollTop;if(active.editing)setSource(false);active.editing=!active.editing;sync();if(active.editing)(sourceMode?$('#source'):editor.view.dom).focus({preventScroll:true});$('#document-scroll').scrollTop=scroll;};
async function guard(){
 if(!active.dirty)return true;
 return new Promise(resolve=>{const dialog=$('#confirm-dialog');let finished=false,saving=false;
  const finish=value=>{if(finished)return;finished=true;dialog.close();resolve(value);};
  $('#confirm-message').textContent=`“${active.name}”的修改尚未写入文件。`;
  $('#cancel-change').onclick=()=>{if(!saving)finish(false);};$('#discard-change').onclick=()=>{if(!saving)finish(true);};
  $('#save-change').onclick=async()=>{saving=true;dialog.querySelectorAll('button').forEach(button=>button.disabled=true);try{finish(await save());}finally{saving=false;dialog.querySelectorAll('button').forEach(button=>button.disabled=false);}};
  dialog.oncancel=event=>{event.preventDefault();if(!saving)finish(false);};dialog.showModal();
 });
}
async function save(saveAs=false,renamed=active.name){
 if(!saveAs&&!active.editing&&!active.dirty&&active.bound)return true;
 const target=active,content=markdown(),revision=target.revision;
 if(new TextEncoder().encode(content).length>2*1024*1024){error('手机端单篇文档不能超过 2 MiB，请减少内容或图片。');return false;}
 try{
  if(native){const result=await call(saveAs?'saveAs':'save',{content,name:renamed,docId:target.docId});if(!result)return false;target.name=result.name||renamed;target.docId=result.docId||target.docId;target.bound=Boolean(result.bound);}
  else{const url=URL.createObjectURL(new Blob([content],{type:'text/markdown;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=renamed;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);target.name=renamed;}
  target.dirty=target.revision!==revision;sync();await flushDraft();toast(native?'文档已保存':'Markdown 已导出');return !target.dirty;
 }catch(reason){error(reason);return false;}
}
async function run(operation){if(busy)return;busy=true;sync();try{await operation();}catch(reason){error(reason);}finally{busy=false;sync();if(incoming)queueMicrotask(drainIncoming);}}
async function openFiles(){if(native){const result=await call('open');for(const data of Array.isArray(result)?result:[result])if(data)load(data);}else $('#file-input').click();}
async function newDocument(){const data=native?await call('new'):{name:'未命名.md'};load({...data,content:null},true);editor.commands.focus('start');}
async function closeTab(tab){
 activate(tab);if(!await guard())return;
 const index=tabs.indexOf(tab);let next=tabs[index+1]||tabs[index-1];
 if(!next){const data=native?await call('new'):{name:'未命名.md',content:null};next=makeTab({...data,content:null},true);tabs.push(next);}
 tabs=tabs.filter(item=>item!==tab);activate(next);renderTabs();await flushDraft();if(native&&tab.docId)await call('close',{docId:tab.docId});
}
function openDrawer(){renderTabs();$('#documents-drawer').showModal();}
let drawerClosing=false;
function closeDrawer(){const drawer=$('#documents-drawer');if(!drawer.open||drawerClosing)return;drawerClosing=true;drawer.classList.add('closing');setTimeout(()=>{drawer.close();drawer.classList.remove('closing');drawerClosing=false;},200);}
$('#toggle-documents').onclick=openDrawer;$('#close-documents').onclick=closeDrawer;
$('#documents-drawer').addEventListener('cancel',event=>{event.preventDefault();closeDrawer();});
$('#documents-drawer').addEventListener('click',event=>{if(event.target===$('#documents-drawer')){const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right)closeDrawer();}});
$('#drawer-new').onclick=()=>{closeDrawer();run(newDocument);};$('#drawer-open').onclick=()=>{closeDrawer();run(openFiles);};
$('#open-file').onclick=()=>run(openFiles);$('#save-file').onclick=()=>run(()=>save());$('#more').onclick=()=>$('#menu-dialog').showModal();$('#insert').onclick=()=>{if(active.editing)$('#insert-dialog').showModal();};
function closeMenus(){for(const id of ['menu-dialog','insert-dialog'])if($('#'+id).open)$('#'+id).close();}
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$('#'+button.dataset.close).close());
$('#new-document').onclick=()=>{closeMenus();run(newDocument);};$('#toggle-source').onclick=()=>{closeMenus();setSource(!sourceMode);};
$('#save-as').onclick=()=>{closeMenus();$('#rename-input').value=active.name;$('#rename-dialog').showModal();};
$('#rename-form').onsubmit=event=>{event.preventDefault();const name=$('#rename-input').value.trim();if(!name||/[\u0000-\u001f/\\]/.test(name))return error('请输入有效的文件名');$('#rename-dialog').close();run(()=>save(true,/\.(md|markdown|txt)$/i.test(name)?name:name+'.md'));};
$('#recover-backup').onclick=()=>{closeMenus();run(async()=>{const data=native?await call('backup',{docId:active.docId}):null;if(data)load(data,true);else toast('暂无可恢复副本');});};
$('#theme').onchange=event=>setTheme(event.target.value);
$('#source').oninput=()=>{if(!active.editing||busy)return;active.dirty=true;active.revision++;sync();scheduleDraft();};$('#source').onkeydown=event=>{if(active.editing&&event.key==='Tab'&&!event.ctrlKey){event.preventDefault();indentSource($('#source'),event.shiftKey);}};
function format(action){if(!active.editing||busy)return;if(sourceMode)setSource(false);const chain=editor.chain().focus();const commands={heading:()=>chain.toggleHeading({level:2}),bold:()=>chain.toggleBold(),italic:()=>chain.toggleItalic(),codeBlock:()=>chain.toggleCodeBlock(),bulletList:()=>chain.toggleBulletList(),undo:()=>chain.undo()};commands[action]?.().run();context();}
for(const button of document.querySelectorAll('[data-format]')){button.onpointerdown=event=>event.preventDefault();button.onclick=()=>format(button.dataset.format);}
document.querySelectorAll('[data-insert]').forEach(button=>button.onclick=()=>{
 if(!active.editing||busy)return;const action=button.dataset.insert;closeMenus();setSource(false);
 if(action==='image'){if(native)run(async()=>{const image=await call('image');if(image)editor.chain().focus().setImage(image).run();});else $('#image-input').click();return;}
 if(action==='link'){$('#link-url').value='';$('#link-text').value='';$('#link-dialog').showModal();return;}
 const chain=editor.chain().focus();if(/^h[1-6]$/.test(action))chain.setHeading({level:Number(action[1])}).run();else{const commands={paragraph:'setParagraph',taskList:'toggleTaskList',orderedList:'toggleOrderedList',blockquote:'toggleBlockquote',code:'toggleCode',codeBlock:'toggleCodeBlock',horizontalRule:'setHorizontalRule'};if(action==='table')chain.insertTable({rows:3,cols:2,withHeaderRow:true}).run();else chain[commands[action]]().run();}
});
$('#language').onchange=event=>{if(active.editing)editor.chain().focus().updateAttributes('codeBlock',{language:event.target.value}).run();};$('#indent-code').onpointerdown=event=>event.preventDefault();$('#indent-code').onclick=()=>{if(active.editing)editor.chain().focus().keyboardShortcut('Tab').run();};
$('#copy-code').onclick=async()=>{const text=editor.state.selection.$from.parent.textContent;try{if(native)await call('copy',{text});else await navigator.clipboard.writeText(text);toast('代码已复制');}catch{error('请选中代码后使用系统复制菜单');}};
$('#link-form').onsubmit=event=>{event.preventDefault();if(!active.editing)return;const value=$('#link-url').value.trim();try{const url=new URL(value);if(!['http:','https:','mailto:'].includes(url.protocol))throw new Error();}catch{return error('请输入网页或邮件链接');}editor.chain().focus().insertContent({type:'text',text:$('#link-text').value||value,marks:[{type:'link',attrs:{href:value}}]}).run();$('#link-dialog').close();};
$('#editor').addEventListener('click',event=>{const link=event.target.closest('a');if(link){event.preventDefault();if(native)call('openLink',{url:link.href}).catch(error);else window.open(link.href,'_blank','noopener,noreferrer');}});
$('#file-input').onchange=event=>run(async()=>{try{for(const file of [...event.target.files]){if(file.size>2*1024*1024)throw new Error('手机端单篇文档不能超过 2 MiB');const content=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());load({name:file.name,content});}}finally{event.target.value='';}});
$('#image-input').onchange=event=>run(async()=>{try{const file=event.target.files[0];if(!file||!active.editing)return;if(file.size>1024*1024)throw new Error('单张图片不能超过 1 MiB');const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});editor.chain().focus().setImage({src,alt:file.name}).run();}finally{event.target.value='';}});
async function drainIncoming(){if(!native||!incoming||!ready||busy||document.querySelector('dialog[open]'))return;incoming=false;await run(async()=>{while(true){let data;try{data=await call('incoming');}catch(reason){incoming=true;throw reason;}if(!data)break;load(data);}});}
window.__tekakuIncoming=()=>{incoming=true;drainIncoming();};
document.addEventListener('close',()=>setTimeout(drainIncoming,0),true);
window.__tekakuBack=async()=>{
 const dialog=document.querySelector('dialog[open]');if(dialog){if(dialog.id==='documents-drawer')closeDrawer();else if(dialog.id==='confirm-dialog')$('#cancel-change').click();else dialog.close();return;}
 if(busy)return;
 await run(async()=>{capture();const discarded=[];for(const tab of tabs.filter(tab=>tab.dirty)){activate(tab);if(!await guard())return;if(tab.dirty)discarded.push(tab);}
  const kept=tabs.filter(tab=>!discarded.includes(tab));if(!kept.length){const data=native?await call('new'):{};kept.push(makeTab({...data,content:null},true));}
  if(!kept.includes(active))activate(kept[0]);tabs=kept;await flushDraft();if(native)await call('exit');
 });
};
window.addEventListener('pagehide',flushDraft);document.addEventListener('visibilitychange',()=>{if(document.hidden)flushDraft();});
window.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();run(()=>save(event.shiftKey));}});
try{
 const state=native?await call('ready'):{draft:JSON.parse(localStorage.getItem('tekaku-mobile-draft')||'null')};const draft=state?.draft;
 if(draft){const records=Array.isArray(draft.tabs)&&draft.tabs.length?draft.tabs:[draft];tabs=records.map(data=>makeTab(data,false));const target=tabs[Math.max(0,Math.min(Number(draft.activeIndex)||0,tabs.length-1))];activate(target);setTheme(draft.theme);}
 else {active.docId=state?.docId||'';sync();}
 ready=true;setTheme(draft?.theme||'white');if(state?.incoming)window.__tekakuIncoming();if(state?.draftError)toast('草稿未能完整恢复，请重新打开原文件');
}catch(reason){ready=true;error('草稿恢复失败，请重新打开原文件');sync();}
window.mobileEditor={flushDraft};
