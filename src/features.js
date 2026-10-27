import { imageSource, literalMatches } from './editor-extensions';
import { codeLanguages, languageName } from './code-languages';
import { indentSource } from './editing';

const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
export function installFeatures({ editor, exitSource, isSource, sourceField, fileName, showError, toast }) {
 const $ = selector => document.querySelector(selector);
 $('.sidebar-content').insertAdjacentHTML('beforeend', `
 <details class="sidebar-tools"><summary>插入</summary>
 <label class="nav-item block-label">段落样式 <select id="block-style" aria-label="段落样式"><option value="0">正文</option>${[1,2,3,4,5,6].map(level=>`<option value="${level}">H${level} 标题</option>`).join('')}</select></label>
 <button class="nav-item" id="code-insert">代码块 <kbd>Ctrl Alt C</kbd></button>
 <button class="nav-item" id="inline-code">行内代码 <kbd>Ctrl E</kbd></button>
 <button class="nav-item" id="bullet-insert">无序列表</button><button class="nav-item" id="ordered-insert">有序列表</button><button class="nav-item" id="task-insert">待办清单</button>
 <button class="nav-item" id="quote-insert">引用</button><button class="nav-item" id="rule-insert">分割线</button>
 <button class="nav-item" id="image-insert">图片 <kbd>Ctrl Shift I</kbd></button>
 <button class="nav-item" id="table-insert">表格</button><button class="nav-item" id="link-edit">链接 <kbd>Ctrl K</kbd></button>
 <button class="nav-item" id="highlight-text">高亮文字</button></details>
 <details class="sidebar-tools"><summary>工具与导出</summary>
 <button class="nav-item" id="search-open">查找与替换 <kbd>Ctrl F</kbd></button>
 <button class="nav-item" id="export-html">导出 HTML</button><button class="nav-item" id="print-page">打印 / PDF</button></details>
 <details id="outline-section" class="sidebar-tools" open hidden><summary>文档大纲</summary><nav id="outline" aria-label="文档大纲"></nav></details>`);
 $('#titlebar').insertAdjacentHTML('afterend', `<div id="search-bar" hidden>
 <div class="search-row"><input id="find-input" aria-label="查找内容" placeholder="查找内容"><span id="find-count">0 项</span><label><input id="find-case" type="checkbox">区分大小写</label><button id="find-prev" title="上一个">↑</button><button id="find-next" title="下一个">↓</button><button id="find-close" aria-label="关闭查找">×</button></div>
 <div class="search-row"><input id="replace-input" aria-label="替换内容" placeholder="替换为"><button id="replace-one">替换</button><button id="replace-all">全部替换</button></div></div>
 <div id="context-tools" hidden><div id="table-tools" hidden>${[['add-row','下方加行'],['add-column','右侧加列'],['delete-row','删除行'],['delete-column','删除列'],['toggle-header','切换表头'],['delete-table','删除表格']].map(([id,title])=>`<button data-table-action="${id}">${title}</button>`).join('')}</div><div id="image-tools" hidden><button id="image-edit">编辑图片说明</button><button id="image-delete">删除图片</button></div><div id="code-tools" hidden><label>语言 <select id="code-language" aria-label="代码语言">${codeLanguages.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><button id="code-copy">复制代码</button><button id="code-wrap" aria-pressed="false">自动换行</button><span class="code-hint">Tab 缩进 · Shift Tab 取消缩进 · 末尾连按三次 Enter 退出</span></div></div>`);
 document.body.insertAdjacentHTML('beforeend', `<input id="image-input" type="file" accept="image/*" multiple hidden>
 <dialog id="image-dialog" class="feature-dialog" aria-labelledby="image-title"><h2 id="image-title">插入图片</h2><form id="image-form"><label>图片地址<input id="image-url" placeholder="https://… 或相对路径" required></label><label>替代文字 / 图片说明<input id="image-alt" placeholder="描述图片内容"></label><div class="dialog-actions"><button type="button" id="image-file-button">选择本地图片</button><button type="button" data-close="image-dialog">取消</button><button class="primary-button">插入</button></div></form></dialog>
 <dialog id="link-dialog" class="feature-dialog" aria-labelledby="link-title"><h2 id="link-title">编辑链接</h2><form id="link-form"><label>链接文字<input id="link-text"></label><label>地址<input id="link-url" placeholder="https://example.com" required></label><div class="dialog-actions"><button type="button" id="link-open">打开链接</button><button type="button" id="link-remove">移除</button><button type="button" data-close="link-dialog">取消</button><button class="primary-button">确定</button></div></form></dialog>`);
 document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => document.getElementById(button.dataset.close).close());
 let editImage = false;
 function imageDialog(edit = false) {
  exitSource(); editImage = edit;
  const attrs = edit ? editor.getAttributes('image') : {};
  $('#image-url').value = attrs.src || ''; $('#image-alt').value = attrs.alt || '';
  $('#image-title').textContent = edit ? '编辑图片' : '插入图片';
  $('#image-dialog button.primary-button').textContent = edit ? '保存' : '插入';
  $('#image-dialog').showModal();
 }
 $('#image-insert').onclick = () => imageDialog(); $('#image-edit').onclick = () => imageDialog(true);
 $('#image-delete').onclick = () => editor.chain().focus().deleteSelection().run();
 $('#image-file-button').onclick = () => { $('#image-dialog').close(); $('#image-input').click(); };
 $('#image-form').onsubmit = event => {
  event.preventDefault(); const src = $('#image-url').value.trim();
  if (!/^(https?:\/\/|data:image\/)/i.test(src) && (/^[a-z]+:/i.test(src) || src.startsWith('/') || src.startsWith('\\'))) return showError('图片地址无效', '使用网页地址、文档目录内的相对路径，或选择本地图片。');
  const attrs = { src, alt: $('#image-alt').value, title: null };
  if (editImage) editor.chain().focus().updateAttributes('image', attrs).run(); else editor.chain().focus().setImage(attrs).run();
  $('#image-dialog').close();
 };
 async function insertFiles(files) {
  exitSource();
  for (const file of Array.from(files).slice(0, 20)) {
   if (file.size > 5*1024*1024) { showError('图片太大', '单张图片不能超过 5 MB'); continue; }
   const types = { png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',bmp:'image/bmp',avif:'image/avif',svg:'image/svg+xml' };
   const mime = types[file.name.split('.').pop().toLowerCase()] || file.type;
   if (!mime?.startsWith('image/')) continue;
   const src = await new Promise((resolve,reject) => { const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(new Blob([file],{type:mime})); });
   editor.chain().focus().setImage({src,alt:file.name.replace(/\.[^.]+$/,'')}).createParagraphNear().run();
  }
 }
 $('#image-input').onchange = async event => { try { await insertFiles(event.target.files); } catch(error) {showError('图片插入失败', error.message || error);} event.target.value=''; };
 const editorElement = $('#editor');
 editorElement.addEventListener('drop', event => { if (event.dataTransfer?.files.length) {event.preventDefault();event.stopPropagation();const pos=editor.view.posAtCoords({left:event.clientX,top:event.clientY});if(pos)editor.commands.setTextSelection(pos.pos);insertFiles(event.dataTransfer.files).catch(error=>showError('图片插入失败',error.message));} }, true);
 editorElement.addEventListener('paste', event => { const files=Array.from(event.clipboardData?.files||[]).filter(file=>file.type.startsWith('image/'));if(files.length){event.preventDefault();event.stopPropagation();insertFiles(files).catch(error=>showError('图片插入失败',error.message));} }, true);
 function linkDialog() {
  exitSource(); if(editor.isActive('link'))editor.commands.extendMarkRange('link'); const selection=editor.state.selection;
  const attrs=editor.getAttributes('link');
  $('#link-text').value=editor.state.doc.textBetween(selection.from,selection.to,' ') || '';
  $('#link-url').value=attrs.href || ''; $('#link-dialog').showModal();
 }
 const validLink = value => {try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?Boolean(url.hostname):url.protocol==='mailto:'&&Boolean(url.pathname);}catch{return false;}};
 $('#link-edit').onclick=linkDialog;
 $('#link-form').onsubmit=event=>{
  event.preventDefault(); const href=$('#link-url').value.trim(); if(!validLink(href))return showError('链接地址无效','请输入 http、https 或 mailto 地址。');
  const label=$('#link-text').value || href;
  const {from,to}=editor.state.selection;
  if(from===to||label!==editor.state.doc.textBetween(from,to,' '))editor.chain().focus().insertContentAt({from,to},{type:'text',text:label,marks:[{type:'link',attrs:{href}}]}).run();
  else editor.chain().focus().extendMarkRange('link').setLink({href}).run();
  $('#link-dialog').close();
 };
 $('#link-remove').onclick=()=>{editor.chain().focus().extendMarkRange('link').unsetLink().run();$('#link-dialog').close();};
 $('#link-open').onclick=async()=>{const url=$('#link-url').value.trim();if(!validLink(url))return;try{if(window.desktop?.openURL)await window.desktop.openURL(url);else window.open(url,'_blank','noopener,noreferrer');}catch(error){showError('无法打开链接',error.message||error);}};
 editorElement.addEventListener('click',event=>{if(event.target.closest('a')){event.preventDefault();linkDialog();}});
 function insertTable() { exitSource(); editor.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run(); }
 $('#table-insert').onclick=insertTable;
 $('#highlight-text').onclick=()=>{exitSource();editor.chain().focus().toggleHighlight().run();};
 const tableActions={'add-row':'addRowAfter','add-column':'addColumnAfter','delete-row':'deleteRow','delete-column':'deleteColumn','toggle-header':'toggleHeaderRow','delete-table':'deleteTable'};
 $('[id=table-tools]').onmousedown=event=>{const button=event.target.closest('[data-table-action]');if(!button)return;event.preventDefault();editor.chain().focus()[tableActions[button.dataset.tableAction]]().run();};
 $('#code-language').onchange=event=>editor.chain().focus().updateAttributes('codeBlock',{language:event.target.value}).run();
 $('#block-style').onchange=event=>{exitSource();const level=Number(event.target.value);if(level)editor.chain().focus().setHeading({level}).run();else editor.chain().focus().setParagraph().run();};
 for(const [id,command] of [['code-insert','toggleCodeBlock'],['inline-code','toggleCode'],['bullet-insert','toggleBulletList'],['ordered-insert','toggleOrderedList'],['task-insert','toggleTaskList'],['quote-insert','toggleBlockquote'],['rule-insert','setHorizontalRule']]){
  $(`#${id}`).onclick=()=>{exitSource();editor.chain().focus()[command]().run();};
 }
 $('#code-wrap').onclick=()=>{const enabled=document.body.classList.toggle('wrap-code');$('#code-wrap').setAttribute('aria-pressed',String(enabled));};
 $('#code-copy').onclick=async()=>{
  const text=editor.state.selection.$from.parent.textContent;
  try{
   let copied=false;
   try{await navigator.clipboard.writeText(text);copied=true;}catch{}
   if(!copied){const field=document.createElement('textarea');field.value=text;field.className='clipboard-field';document.body.append(field);field.focus();field.select();try{copied=document.execCommand('copy');}finally{field.remove();editor.commands.focus();}}
   if(!copied)throw new Error('系统未允许访问剪贴板，请选中代码后按 Ctrl+C。');
   toast('代码已复制');
  }catch(error){showError('复制失败',error.message||error);}
 };
 sourceField().addEventListener('keydown',event=>{if(event.key==='Tab'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.isComposing){event.preventDefault();indentSource(sourceField(),event.shiftKey);}});
 function context() {
  const table=editor.isActive('table'),image=editor.isActive('image'),code=editor.isActive('codeBlock');
  $('#context-tools').hidden=isSource()||!(table||image||code);$('#table-tools').hidden=!table;$('#image-tools').hidden=!image;$('#code-tools').hidden=!code;
  $('#block-style').value=String(editor.getAttributes('heading').level || 0);
  if(code){
    const language=editor.getAttributes('codeBlock').language || 'plaintext';
    const selected=languageName(language);
    const select=$('#code-language');
    if(![...select.options].some(option=>option.value===selected)){const option=document.createElement('option');option.value=selected;option.textContent=language+'（无高亮）';select.append(option);}
    select.value=selected;
  }
 }
 editor.on('selectionUpdate',context); editor.on('transaction',context);
 let outlineTimer;
 function outline() {
  const headings=[];let outlineDoc=editor.state.doc;
  if(isSource()){try{outlineDoc=editor.schema.nodeFromJSON(editor.markdown.parse(sourceField().value));}catch{}}
  outlineDoc.descendants((node,pos)=>{if(node.type.name==='heading'&&node.textContent.trim())headings.push({text:node.textContent,level:node.attrs.level,pos});});
  $('#outline-section').hidden=!headings.length;$('#outline').replaceChildren();
  for(const heading of headings){const button=document.createElement('button');button.textContent=heading.text;button.style.paddingLeft=`${10+(heading.level-1)*10}px`;button.onclick=()=>{exitSource();editor.chain().focus().setTextSelection(heading.pos+1).scrollIntoView().run();};$('#outline').append(button);}
 }
 const search=editor.storage.documentSearch;
 function matches() {return isSource()?literalMatches(sourceField().value,search.query,search.sensitive):search.matches;}
 function refreshSearch() {
  if($('#search-bar').hidden)return;
  search.query=$('#find-input').value;search.sensitive=$('#find-case').checked;
  editor.view.dispatch(editor.state.tr.setMeta('documentSearch',true));
  const list=matches();search.active=Math.min(search.active,Math.max(0,list.length-1));$('#find-count').textContent=list.length?`${search.active+1} / ${list.length}${list.length===10000?'+':''}`:'0 项';
 }
 function goMatch(delta=0){refreshSearch();const list=matches();if(!list.length)return;search.active=(search.active+delta+list.length)%list.length;const match=list[search.active];if(isSource()){sourceField().focus();sourceField().setSelectionRange(match.from,match.to);}else editor.chain().setTextSelection(match).scrollIntoView().run();refreshSearch();}
 function openSearch(){$('#search-bar').hidden=false;$('#find-input').focus();$('#find-input').select();refreshSearch();}
 $('#search-open').onclick=openSearch;
 $('#find-input').oninput=()=>{search.active=0;refreshSearch();};$('#find-case').onchange=refreshSearch;
 $('#find-prev').onclick=()=>goMatch(-1);$('#find-next').onclick=()=>goMatch(1);
 $('#find-input').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();goMatch(event.shiftKey?-1:1);}if(event.key==='Escape'){event.preventDefault();$('#find-close').click();}};
 $('#find-close').onclick=()=>{$('#search-bar').hidden=true;search.query='';editor.view.dispatch(editor.state.tr.setMeta('documentSearch',true));};
 function replace(all){refreshSearch();const list=matches();if(!list.length)return;if(all&&list.length===10000)return showError('匹配过多','请缩小查找范围后再替换。');const chosen=all?list:[list[search.active]];const value=$('#replace-input').value;
  if(isSource()){let text=sourceField().value;for(const m of [...chosen].reverse())text=text.slice(0,m.from)+value+text.slice(m.to);sourceField().value=text;sourceField().dispatchEvent(new Event('input',{bubbles:true}));}
  else {let tr=editor.state.tr;for(const m of [...chosen].reverse())tr=tr.insertText(value,m.from,m.to);editor.view.dispatch(tr);}refreshSearch();}
 $('#replace-one').onclick=()=>replace(false);$('#replace-all').onclick=()=>replace(true);
 async function exportHTML(print=false){
  exitSource();
  if(print){await Promise.race([Promise.all([...document.querySelectorAll('.image-node img')].map(img=>img.decode().catch(()=>{}))),new Promise(resolve=>setTimeout(resolve,5000))]);window.print();return;}
  const doc=new DOMParser().parseFromString(editor.getHTML(),'text/html');
  for(const img of doc.querySelectorAll('img')) { const src=await imageSource(img.getAttribute('src')||'');if(src)img.src=src; }
  const style=`body{max-width:860px;margin:48px auto;padding:0 30px;color:#202632;font:16px/1.85 system-ui,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd1d8;padding:8px}th{background:#f1f3f6}pre{white-space:pre-wrap;background:#f3f4f6;padding:18px}blockquote{border-left:3px solid #ccd1d8;margin-left:0;padding-left:20px;color:#657}ul[data-type=taskList]{list-style:none;padding-left:0}ul[data-type=taskList]>li{display:flex;gap:10px}ul[data-type=taskList] p{margin:0}@media print{body{margin:0;max-width:none}pre,blockquote,table,img{break-inside:avoid}}`;
  const html=`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https: http:; base-uri 'none'; form-action 'none'"><title>${escapeHTML(fileName())}</title><style>${style}</style></head><body>${doc.body.innerHTML}</body></html>`;

  if(window.desktop?.exportHTML){if(await window.desktop.exportHTML({name:fileName(),content:html}))toast('HTML 已导出');}
  else {const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=fileName().replace(/\.[^.]+$/,'')+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 }
 $('#export-html').onclick=()=>exportHTML().catch(error=>showError('导出失败',error.message||error));
 $('#print-page').onclick=()=>exportHTML(true).catch(error=>showError('打印失败',error.message||error));
 document.addEventListener('keydown',event=>{if(!(event.ctrlKey||event.metaKey)||event.defaultPrevented)return;const key=event.key.toLowerCase();if(key==='f'||key==='h'){event.preventDefault();openSearch();if(key==='h')$('#replace-input').focus();}if(key==='k'){event.preventDefault();linkDialog();}if(key==='i'&&event.shiftKey){event.preventDefault();imageDialog();}if(key==='p'){event.preventDefault();exportHTML(true).catch(error=>showError('打印失败',error.message||error));}});
 outline();context();
 return { imageDialog, insertTable, linkDialog, onUpdate(){clearTimeout(outlineTimer);outlineTimer=setTimeout(outline,180);refreshSearch();}, onLoad(){outline();refreshSearch();context();}, sourceChanged(){context();refreshSearch();clearTimeout(outlineTimer);outlineTimer=setTimeout(outline,180);} };
}
