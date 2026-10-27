import { icon } from './icons';
import { replaceSource, readClipboard, writeClipboard } from './source-actions';
const actionIcons={'context-undo':'undo','context-redo':'redo','context-cut':'cut','context-copy':'copy','context-paste':'paste','code-insert':'code','inline-code':'code','table-insert':'table','image-insert':'image','link-edit':'link','bullet-insert':'bulletList','ordered-insert':'orderedList','task-insert':'taskList','quote-insert':'quote','rule-insert':'rule','highlight-text':'highlight','context-image-edit':'image','context-image-delete':'close'};
const item=(id,text,shortcut='')=>`<button id="${id}" role="menuitem" tabindex="-1">${icon(actionIcons[id])}<span>${text}</span>${shortcut?`<kbd>${shortcut}</kbd>`:''}</button>`;
export const contextMenuHTML=`
 <div id="editor-context-menu" class="context-menu" role="menu" aria-label="编辑菜单" hidden>
  ${item('context-undo','撤销','Ctrl Z')}${item('context-redo','重做','Ctrl Shift Z')}<div role="separator"></div>
  ${item('context-cut','剪切文本','Ctrl X')}${item('context-copy','复制文本','Ctrl C')}${item('context-paste','粘贴文本','Ctrl V')}<div role="separator"></div>
  <button id="context-style" role="menuitem" tabindex="-1" aria-haspopup="menu" aria-expanded="false" aria-controls="heading-context-menu">${icon('paragraph')}<span>段落样式</span>${icon('chevron')}</button>
  <button id="context-insert" role="menuitem" tabindex="-1" aria-haspopup="menu" aria-expanded="false" aria-controls="insert-context-menu">${icon('plus')}<span>插入内容</span>${icon('chevron')}</button>
  <div id="context-image-actions" hidden><div role="separator"></div>${item('context-image-edit','编辑图片说明')}${item('context-image-delete','删除图片')}</div>
 </div>
 <div id="heading-context-menu" class="context-menu submenu" role="menu" aria-label="段落样式" hidden>${[0,1,2,3,4,5,6].map(level=>`<button role="menuitem" data-heading-level="${level}" tabindex="-1"><span>${level?`H${level}　${['','一级','二级','三级','四级','五级','六级'][level]}标题`:'正文'}</span>${level?`<kbd>Ctrl Alt ${level}</kbd>`:''}</button>`).join('')}</div>
 <div id="insert-context-menu" class="context-menu submenu" role="menu" aria-label="插入内容" hidden>
  ${item('code-insert','代码块','Ctrl Alt C')}${item('inline-code','行内代码','Ctrl E')}${item('table-insert','表格')}${item('image-insert','图片','Ctrl Shift I')}${item('link-edit','链接','Ctrl K')}<div role="separator"></div>
  ${item('bullet-insert','无序列表')}${item('ordered-insert','有序列表')}${item('task-insert','待办清单')}${item('quote-insert','引用')}${item('rule-insert','分割线')}${item('highlight-text','高亮文字')}
 </div>`;

export function installContextMenu({editor,isSource,sourceField,showError,toast,imageDialog}) {
  const menu=document.querySelector('#editor-context-menu');
  const popups=[...document.querySelectorAll('.context-menu')];
  const parents=[...menu.querySelectorAll('[aria-controls]')];
  let currentRange=null,sourceAtOpen=false;
  const elements=popup=>[...popup.querySelectorAll('[role=menuitem]')].filter(button=>!button.disabled&&!button.closest('[hidden]'));
  function position(popup,x,y){popup.hidden=false;const rect=popup.getBoundingClientRect();popup.style.left=`${Math.max(8,Math.min(x,innerWidth-rect.width-8))}px`;popup.style.top=`${Math.max(8,Math.min(y,innerHeight-rect.height-8))}px`;}
  function closeSub(){for(const parent of parents){document.getElementById(parent.getAttribute('aria-controls')).hidden=true;parent.setAttribute('aria-expanded','false');}}
  function close(focus=false){closeSub();menu.hidden=true;if(focus){if(sourceAtOpen){sourceField().focus();if(currentRange)sourceField().setSelectionRange(currentRange.from,currentRange.to);}else editor.view.focus();}}
  function submenu(parent,focus=false){closeSub();const popup=document.getElementById(parent.getAttribute('aria-controls'));popup.hidden=false;const anchor=parent.getBoundingClientRect(),width=popup.getBoundingClientRect().width;position(popup,anchor.right+width+8<innerWidth?anchor.right+4:anchor.left-width-4,anchor.top-5);parent.setAttribute('aria-expanded','true');if(focus)elements(popup)[0]?.focus();}
  function open(x,y,keyboard=false){
    sourceAtOpen=isSource();
    if(sourceAtOpen)currentRange={from:sourceField().selectionStart,to:sourceField().selectionEnd};
    else if(!keyboard){
      const pos=editor.view.posAtCoords({left:x,top:y});const selection=editor.state.selection;
      if(pos&&(selection.empty||pos.pos<selection.from||pos.pos>selection.to)){
        const figure=document.elementFromPoint(x,y)?.closest('.image-node');
        if(figure){let found;editor.state.doc.descendants((node,p)=>{if(node.type.name==='image'&&editor.view.nodeDOM(p)===figure)found=p;});if(found!==undefined)editor.commands.setNodeSelection(found);}
        else editor.commands.setTextSelection(pos.pos);
      }
    }
    const selection=editor.state.selection;
    const selected=sourceAtOpen?sourceField().value.slice(currentRange.from,currentRange.to):editor.state.doc.textBetween(selection.from,selection.to,'\n');
    menu.querySelector('#context-copy').disabled=!selected;menu.querySelector('#context-cut').disabled=!selected;
    menu.querySelector('#context-undo').disabled=!sourceAtOpen&&!editor.can().undo();menu.querySelector('#context-redo').disabled=!sourceAtOpen&&!editor.can().redo();
    document.querySelector('#context-image-actions').hidden=sourceAtOpen||!editor.isActive('image');
    closeSub();position(menu,x,y);elements(menu)[0]?.focus();
  }
  document.addEventListener('contextmenu',event=>{if(!event.target.closest('#editor, #source-editor'))return;event.preventDefault();open(event.clientX,event.clientY);});
  document.addEventListener('keydown',event=>{
    if((event.key==='ContextMenu'||event.shiftKey&&event.key==='F10')&&event.target.closest('#editor, #source-editor')){
      event.preventDefault();const rect=isSource()?sourceField().getBoundingClientRect():editor.view.coordsAtPos(editor.state.selection.head);open(rect.left+10,rect.top+20,true);return;
    }
    if(menu.hidden)return;
    const popup=document.activeElement?.closest('.context-menu')||menu;const list=elements(popup),at=list.indexOf(document.activeElement);
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?list.length-1:(at+(event.key==='ArrowDown'?1:-1)+list.length)%list.length;list[index]?.focus();}
    if(event.key==='ArrowRight'){const parent=document.activeElement;if(parent?.hasAttribute('aria-controls')){event.preventDefault();submenu(parent,true);}}
    if(event.key==='ArrowLeft'&&popup!==menu){event.preventDefault();const parent=parents.find(p=>p.getAttribute('aria-controls')===popup.id);closeSub();parent?.focus();}
    if(event.key==='Escape'){event.preventDefault();close(true);}
    if(event.key==='Tab'){close(true);}
  },true);
  for(const parent of parents){parent.onmouseenter=()=>submenu(parent);parent.onclick=()=>submenu(parent,true);}
  for(const popup of popups)popup.addEventListener('click',event=>{const button=event.target.closest('[role=menuitem]');if(button&&!button.hasAttribute('aria-controls'))close(false);},true);
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.context-menu'))close();},true);
  document.querySelector('.page-scroll').addEventListener('scroll',()=>close(),{passive:true});window.addEventListener('resize',()=>close());window.addEventListener('blur',()=>close());
  document.querySelector('#context-undo').onclick=()=>{if(sourceAtOpen){sourceField().focus();document.execCommand('undo');}else editor.chain().focus().undo().run();};
  document.querySelector('#context-redo').onclick=()=>{if(sourceAtOpen){sourceField().focus();document.execCommand('redo');}else editor.chain().focus().redo().run();};
  async function clipboard(action){
    const source=sourceAtOpen,field=sourceField(),range=currentRange,doc=editor.state.doc,selection=editor.state.selection,value=field.value;
    try{
      const text=source?value.slice(range.from,range.to):doc.textBetween(selection.from,selection.to,'\n');
      if(action==='copy'||action==='cut')await writeClipboard(text);
      if(action==='paste'){
        const pasted=await readClipboard();if(!pasted){toast('剪贴板没有文本');return;}
        if(source!==isSource()||(source?field.value!==value:editor.state.doc!==doc)){toast('文档已变化，请重新粘贴');return;}
        if(source)replaceSource(field,pasted,range);else {editor.commands.setTextSelection({from:selection.from,to:selection.to});editor.view.focus();editor.view.pasteText(pasted);}
      }else if(action==='cut'){
        if(source!==isSource()||(source?field.value!==value:editor.state.doc!==doc)){toast('已复制；文档变化后未删除原文');return;}
        if(source)replaceSource(field,'',range);else editor.chain().focus().deleteRange({from:selection.from,to:selection.to}).run();
      }else if(source){field.focus();field.setSelectionRange(range.from,range.to);}else editor.view.focus();
    }catch(error){showError('剪贴板操作失败',error.message||error);}
  }
  for(const action of ['cut','copy','paste'])document.querySelector('#context-'+action).onclick=()=>clipboard(action);
  document.querySelector('#context-image-edit').onclick=()=>imageDialog(true);
  document.querySelector('#context-image-delete').onclick=()=>editor.chain().focus().deleteSelection().run();
  return {close};
}
