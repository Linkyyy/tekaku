import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from '@tiptap/markdown';
import { extraExtensions } from '../src/editor-extensions';
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
const icons={
 open:'<path d="M3 7h7l2 2h9l-3 11H3V7Zm0 0V4h6l2 3"/>',
 save:'<path d="M4 3h13l4 4v14H3V3Zm4 0v6h8V3M7 21v-8h10v8"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 undo:'<path d="m8 5-5 5 5 5M3 10h10a6 6 0 0 1 0 12"/>',
 redo:'<path d="m16 5 5 5-5 5m5-5h-10a6 6 0 0 0 0 12"/>',
 code:'<path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16"/>',
 list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h1m-1 6h1m-1 6h1"/>',
 plus:'<path d="M12 4v16M4 12h16"/>',
};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
$('#mobile').innerHTML=`
 <header><span class="brand-mark" aria-hidden="true">手</span><div class="file-info"><strong id="file-name">未命名.md</strong><span id="file-status" role="status">本机草稿</span></div><button id="open-file" aria-label="打开 Markdown" title="打开">${icon('open')}</button><button id="save-file" aria-label="保存文档" title="保存">${icon('save')}</button><button id="more" aria-label="更多">${icon('more')}</button></header>
 <div id="code-context" hidden><label>语言<select id="language" aria-label="代码语言">${codeLanguages.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><button id="copy-code">复制</button><button id="indent-code" aria-label="增加代码缩进">⇥</button></div>
 <main id="document-scroll"><div id="editor"></div><textarea id="source" aria-label="Markdown 源码" spellcheck="false" hidden></textarea></main>
 <nav id="format-bar" aria-label="编辑工具"><button data-format="heading" aria-label="标题">H<span>₂</span></button><button data-format="bold" aria-label="粗体"><b>B</b></button><button data-format="italic" aria-label="斜体"><i>I</i></button><button data-format="codeBlock" aria-label="代码块">${icon('code')}</button><button data-format="bulletList" aria-label="列表">${icon('list')}</button><button data-format="undo" aria-label="撤销">${icon('undo')}</button><button id="insert" aria-label="插入内容">${icon('plus')}</button></nav>
 <dialog id="menu-dialog" class="sheet" aria-labelledby="menu-title"><div class="sheet-heading"><h2 id="menu-title">文档</h2><button data-close="menu-dialog" aria-label="关闭菜单">×</button></div><button class="menu-row" id="new-document">新建文档<span>＋</span></button><button class="menu-row" id="save-as">另存为<span>↗</span></button><button class="menu-row" id="toggle-source">Markdown 源码<span id="source-label">切换</span></button><button class="menu-row" id="recover-backup">恢复上次写入前的副本<span>↶</span></button><label class="menu-row">皮肤<select id="theme" aria-label="皮肤"><option value="white">纯白</option><option value="paper">纸笺</option><option value="sage">青苔</option><option value="night">深夜</option></select></label><p class="menu-note">手书 Android 0.1.0 · 文档与草稿保存在本机<br>网络图片会访问对应地址。相对路径图片需重新选择插入。</p></dialog>
 <dialog id="insert-dialog" class="sheet" aria-labelledby="insert-title"><div class="sheet-heading"><h2 id="insert-title">插入</h2><button data-close="insert-dialog" aria-label="关闭插入菜单">×</button></div><div class="insert-grid">${[['paragraph','正文'],['h1','一级标题'],['h2','二级标题'],['h3','三级标题'],['h4','四级标题'],['h5','五级标题'],['h6','六级标题'],['taskList','待办清单'],['orderedList','有序列表'],['blockquote','引用'],['code','行内代码'],['codeBlock','代码块'],['table','表格'],['image','本地图片'],['link','链接'],['horizontalRule','分割线']].map(([id,label])=>`<button data-insert="${id}">${label}</button>`).join('')}</div></dialog>
 <dialog id="confirm-dialog" class="message-dialog" aria-labelledby="confirm-title"><h2 id="confirm-title">保存修改？</h2><p>当前修改尚未写入文件。</p><div class="dialog-actions"><button id="cancel-change">取消</button><button id="discard-change">不保存</button><button id="save-change" class="primary">保存</button></div></dialog>
 <dialog id="error-dialog" class="message-dialog" aria-labelledby="error-title"><h2 id="error-title">操作失败</h2><p id="error-text"></p><div class="dialog-actions"><button data-close="error-dialog" class="primary">知道了</button></div></dialog>
 <dialog id="link-dialog" class="message-dialog" aria-labelledby="link-title"><h2 id="link-title">插入链接</h2><form id="link-form"><label>链接文字<input id="link-text"></label><label>地址<input id="link-url" type="url" placeholder="https://example.com" required></label><div class="dialog-actions"><button type="button" data-close="link-dialog">取消</button><button class="primary">插入</button></div></form></dialog>
 <dialog id="rename-dialog" class="message-dialog" aria-labelledby="rename-title"><h2 id="rename-title">另存为</h2><form id="rename-form"><label>文件名<input id="rename-input" required maxlength="120"></label><div class="dialog-actions"><button type="button" data-close="rename-dialog">取消</button><button class="primary">继续</button></div></form></dialog>
 <input id="file-input" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden><input id="image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
 <div id="toast" role="status"></div>`;

let name='未命名.md',docId='',hasFile=false,dirty=false,sourceMode=false,sourceBefore='',theme='white',busy=false,incoming=false;
let draftTimer,toastTimer,draftWriting=false,draftPending=false;
const blank={type:'doc',content:[{type:'heading',attrs:{level:1}},{type:'paragraph'}]};
const editor=new Editor({
 element:$('#editor'),extensions:[StarterKit.configure({codeBlock:false,undoRedo:{depth:30},link:{openOnClick:false}}),Placeholder.configure({showOnlyCurrent:false,placeholder:({node})=>node.type.name==='heading'&&node.attrs.level===1?'请输入标题':'开始写点什么…'}),TaskList,TaskItem.configure({nested:true}),...extraExtensions,Markdown],
 content:blank,editorProps:{attributes:{'aria-label':'文档编辑器',spellcheck:'false'}},
 onUpdate(){dirty=true;sync();scheduleDraft();},onSelectionUpdate(){context();},
});
function markdown(){return sourceMode?$('#source').value:editor.getMarkdown();}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2500);}
function error(reason){$('#error-text').textContent=reason?.message||String(reason);if(!$('#error-dialog').open)$('#error-dialog').showModal();}
function sync(){
 $('#file-name').textContent=name;$('#file-status').textContent=busy?'正在处理…':dirty?'修改未保存':hasFile?'已保存到文件':'本机草稿';
 if(editor.isEditable===busy)editor.setEditable(!busy,false);
 $('#source').disabled=busy;
 for(const button of document.querySelectorAll('header button, #format-bar button'))button.disabled=busy;
 document.title=name+' · 手书';context();
}
function context(){
 const code=!sourceMode&&editor.isActive('codeBlock');$('#code-context').hidden=!code;
 if(code){const language=editor.getAttributes('codeBlock').language||'plaintext';const canonical=languageName(language);const select=$('#language');if(![...select.options].some(x=>x.value===canonical)){const option=document.createElement('option');option.value=canonical;option.textContent=language+'（纯文本）';select.append(option);}select.value=canonical;}
 for(const button of document.querySelectorAll('[data-format]'))button.setAttribute('aria-pressed',String(!sourceMode&&editor.isActive(button.dataset.format==='heading'?'heading':button.dataset.format)));
 $('#source-label').textContent=sourceMode?'编辑视图':'切换';
}
function snapshot(){return {name,docId,bound:hasFile,content:markdown(),dirty,theme,sourceMode};}
function scheduleDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(flushDraft,550);}
async function flushDraft(){
 clearTimeout(draftTimer);if(draftWriting){draftPending=true;return;}
 draftWriting=true;
 try{const data=snapshot();if(native)await call('draft',data);else localStorage.setItem('tekaku-mobile-draft',JSON.stringify(data));}
 catch(reason){toast('草稿未能写入，请保存到文件');}
 finally{draftWriting=false;if(draftPending){draftPending=false;flushDraft();}}
}
function setTheme(value){theme=['white','paper','sage','night'].includes(value)?value:'white';document.body.dataset.theme=theme;$('#theme').value=theme;scheduleDraft();if(native)call('theme',{value:theme}).catch(()=>{});}
function setSource(value){
 if(value===sourceMode)return;
 if(value){sourceBefore=editor.getMarkdown();$('#source').value=sourceBefore;}
 else{if($('#source').value!==sourceBefore)editor.commands.setContent($('#source').value,{contentType:'markdown',emitUpdate:false});$('#source').value='';sourceBefore='';}
 sourceMode=value;$('#source').hidden=!value;$('#editor').hidden=value;context();scheduleDraft();
}
function load(data){
 setSource(false);name=data.name||'未命名.md';docId=data.docId||'';hasFile=Boolean(data.bound);
 editor.commands.setContent(data.content||blank,{contentType:data.content?'markdown':'json',emitUpdate:false});
 dirty=Boolean(data.dirty);sync();scheduleDraft();$('#document-scroll').scrollTop=0;
}
async function guard(){
 if(!dirty)return true;
 return new Promise(resolve=>{
  const dialog=$('#confirm-dialog');dialog.showModal();
  const finish=value=>{if(!dialog.open)return;dialog.close();resolve(value);};
  $('#cancel-change').onclick=()=>finish(false);$('#discard-change').onclick=()=>finish(true);
  $('#save-change').onclick=async()=>{const button=$('#save-change');button.disabled=true;try{if(await save(false))finish(true);}finally{button.disabled=false;}};
  dialog.oncancel=event=>{event.preventDefault();finish(false);};
 });
}
async function save(saveAs=false,renamed=name){
 const content=markdown();
 if(new TextEncoder().encode(content).length>2*1024*1024){error('手机端单篇文档不能超过 2 MiB，请减少内容或图片。');return false;}
 try{
  if(native){const result=await call(saveAs?'saveAs':'save',{content,name:renamed,docId});if(!result)return false;name=result.name||renamed;docId=result.docId||docId;hasFile=true;}
  else{const url=URL.createObjectURL(new Blob([content],{type:'text/markdown;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=renamed;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);name=renamed;}
  dirty=false;sync();await flushDraft();toast(native?'文档已保存':'Markdown 已导出');return true;
 }catch(reason){error(reason);return false;}
}
async function run(operation){
 if(busy)return;busy=true;sync();
 try{await operation();}catch(reason){error(reason);}finally{busy=false;sync();if(incoming){incoming=false;window.__tekakuIncoming();}}
}
function closeMenus(){for(const id of ['menu-dialog','insert-dialog'])if($( '#'+id).open)$('#'+id).close();}
$('#open-file').onclick=()=>run(async()=>{if(!await guard())return;if(native){const result=await call('open');if(result)load(result);}else $('#file-input').click();});
$('#save-file').onclick=()=>run(()=>save());
$('#more').onclick=()=>{$('#menu-dialog').showModal();};$('#insert').onclick=()=>{$('#insert-dialog').showModal();};
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$('#'+button.dataset.close).close());
$('#new-document').onclick=()=>{closeMenus();run(async()=>{if(!await guard())return;const data=native?await call('new'):{name:'未命名.md',content:''};load(data);});};
$('#toggle-source').onclick=()=>{closeMenus();setSource(!sourceMode);};
$('#save-as').onclick=()=>{closeMenus();$('#rename-input').value=name;$('#rename-dialog').showModal();};
$('#rename-form').onsubmit=event=>{event.preventDefault();let value=$('#rename-input').value.trim();if(!value||/[\x00-\x1f/\\]/.test(value))return error('请输入有效的文件名');if(!/\.(md|markdown|txt)$/i.test(value))value+='.md';$('#rename-dialog').close();run(()=>save(true,value));};
$('#recover-backup').onclick=()=>{closeMenus();run(async()=>{if(!native)return error('此功能需要 Android 安装版');if(!await guard())return;const data=await call('backup');if(data)load({...data,dirty:true});else toast('还没有写入前副本');});};
$('#theme').onchange=event=>setTheme(event.target.value);
$('#source').oninput=()=>{dirty=true;sync();scheduleDraft();};
$('#source').onkeydown=event=>{if(event.key==='Tab'){event.preventDefault();indentSource($('#source'),event.shiftKey);}};

function format(action){
 if(sourceMode)setSource(false);
 const chain=editor.chain().focus();
 const commands={heading:()=>chain.toggleHeading({level:2}),bold:()=>chain.toggleBold(),italic:()=>chain.toggleItalic(),codeBlock:()=>chain.toggleCodeBlock(),bulletList:()=>chain.toggleBulletList(),undo:()=>chain.undo()};
 commands[action]?.().run();context();
}
for(const button of document.querySelectorAll('[data-format]')){button.onpointerdown=event=>event.preventDefault();button.onclick=()=>format(button.dataset.format);}
document.querySelectorAll('[data-insert]').forEach(button=>button.onclick=()=>{
 const action=button.dataset.insert;closeMenus();setSource(false);
 if(action==='image'){if(native)run(async()=>{const image=await call('image');if(image)editor.chain().focus().setImage(image).run();});else $('#image-input').click();return;}
 if(action==='link'){$('#link-url').value='';$('#link-text').value='';$('#link-dialog').showModal();return;}
 const chain=editor.chain().focus();
 if(/^h[1-6]$/.test(action))chain.setHeading({level:Number(action[1])}).run();
 else{const commands={paragraph:'setParagraph',taskList:'toggleTaskList',orderedList:'toggleOrderedList',blockquote:'toggleBlockquote',code:'toggleCode',codeBlock:'toggleCodeBlock',table:'insertTable',horizontalRule:'setHorizontalRule'};if(action==='table')chain.insertTable({rows:3,cols:2,withHeaderRow:true}).run();else chain[commands[action]]().run();}
});
$('#language').onchange=event=>editor.chain().focus().updateAttributes('codeBlock',{language:event.target.value}).run();
$('#indent-code').onpointerdown=event=>event.preventDefault();$('#indent-code').onclick=()=>editor.chain().focus().keyboardShortcut('Tab').run();
$('#copy-code').onclick=async()=>{const text=editor.state.selection.$from.parent.textContent;try{if(native)await call('copy',{text});else await navigator.clipboard.writeText(text);toast('代码已复制');}catch(reason){error('请选中代码后使用系统复制菜单');}};
$('#link-form').onsubmit=event=>{event.preventDefault();const value=$('#link-url').value.trim();try{const url=new URL(value);if(!['http:','https:','mailto:'].includes(url.protocol))throw new Error();}catch{return error('请输入网页或邮件链接');}editor.chain().focus().insertContent({type:'text',text:$('#link-text').value||value,marks:[{type:'link',attrs:{href:value}}]}).run();$('#link-dialog').close();};
$('#editor').addEventListener('click',event=>{const link=event.target.closest('a');if(link){event.preventDefault();if(native)call('openLink',{url:link.href}).catch(error);else window.open(link.href,'_blank','noopener,noreferrer');}});
$('#file-input').onchange=event=>run(async()=>{try{const file=event.target.files[0];if(!file)return;if(file.size>2*1024*1024)throw new Error('手机端单篇文档不能超过 2 MiB');const content=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());load({name:file.name,content});}finally{event.target.value='';}});
$('#image-input').onchange=event=>run(async()=>{try{const file=event.target.files[0];if(!file)return;if(file.size>1024*1024)throw new Error('单张图片不能超过 1 MiB');const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});editor.chain().focus().setImage({src,alt:file.name}).run();}finally{event.target.value='';}});

window.__tekakuIncoming=()=>{if(busy){incoming=true;return;}run(async()=>{if(await guard()){const data=await call('incoming');if(data)load(data);}else await call('discardIncoming');});};
window.__tekakuBack=async()=>{const dialog=document.querySelector('dialog[open]');if(dialog){if(dialog.id==='confirm-dialog')$('#cancel-change').click();else dialog.close();return;}if(busy)return;if(await guard()){await flushDraft();if(native)call('exit').catch(error);}};
window.addEventListener('pagehide',flushDraft);document.addEventListener('visibilitychange',()=>{if(document.hidden)flushDraft();});
window.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();run(()=>save(event.shiftKey));}});
try{
 const state=native?await call('ready'):{draft:JSON.parse(localStorage.getItem('tekaku-mobile-draft')||'null')};
 docId=state?.docId||'';
 if(state?.draft){load(state.draft);if(state.draft.sourceMode)setSource(true);setTheme(state.draft.theme);}
 else{sync();$('#file-status').textContent='本机草稿';}
 if(state?.incoming)window.__tekakuIncoming();
 if(state?.draftError)toast('草稿未能恢复，请重新打开原文件');
}catch(reason){error('草稿恢复失败，请重新打开原文件');}
window.mobileEditor={flushDraft};
