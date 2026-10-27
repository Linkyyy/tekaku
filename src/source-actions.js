export function replaceSource(field, text, range = { from: field.selectionStart, to: field.selectionEnd }) {
  field.focus();field.setSelectionRange(range.from,range.to);
  if(!document.execCommand('insertText',false,text)){
    field.setRangeText(text,range.from,range.to,'end');
    field.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));
  }
}
export function insertSource(field, action) {
  const from=field.selectionStart,to=field.selectionEnd,selected=field.value.slice(from,to);
  if(/^h[0-6]$/.test(action)){
    const start=from===0?0:field.value.lastIndexOf('\n',from-1)+1;
    const end=field.value.indexOf('\n',to);const stop=end<0?field.value.length:end;
    const prefix='#'.repeat(Number(action[1]));
    replaceSource(field,(prefix?prefix+' ':'')+field.value.slice(start,stop).replace(/^#{1,6}\s+/,''),{from:start,to:stop});return;
  }
  const templates={codeBlock:`\n\`\`\`plaintext\n${selected}\n\`\`\`\n`,code:'`'+selected+'`',bulletList:'- '+selected,orderedList:'1. '+selected,taskList:'- [ ] '+selected,blockquote:'> '+selected,horizontalRule:'\n---\n',table:'\n| 标题 | 标题 |\n| --- | --- |\n| 内容 | 内容 |\n',highlight:'=='+selected+'=='};
  if(action in templates)replaceSource(field,templates[action]);
}
export async function writeClipboard(text) {
  if(window.desktop?.clipboardWrite)return window.desktop.clipboardWrite(text);
  if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text);
  const field=document.createElement('textarea');field.value=text;field.className='clipboard-field';document.body.append(field);field.focus();field.select();
  try{if(!document.execCommand('copy'))throw new Error('请选中文字后按 Ctrl+C 复制。');}finally{field.remove();}
}
export async function readClipboard() {
  if(window.desktop?.clipboardRead)return window.desktop.clipboardRead();
  if(navigator.clipboard?.readText)return navigator.clipboard.readText();
  throw new Error('当前浏览器不允许读取剪贴板，请在编辑区按 Ctrl+V。');
}
