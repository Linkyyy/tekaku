export function installWindowFiles({ confirmDiscard, loadDocument, showError, toast, windowAction }) {
  const app = document.querySelector('#app');
  const hint = document.createElement('div');
  hint.id = 'file-drop-hint'; hint.hidden = true; hint.textContent = '松开以打开 Markdown 文件';
  app.append(hint);
  if (window.desktop?.window) {
    for (const edge of ['left','right','top','bottom','top-left','top-right','bottom-left','bottom-right']) {
      const handle=document.createElement('div');handle.className='resize-handle';handle.dataset.resize=edge;
      handle.title='拖动调整窗口大小';handle.setAttribute('aria-hidden','true');
      handle.onpointerdown=event=>{if(event.button===0){event.preventDefault();windowAction('resize-'+edge);}};
      app.append(handle);
    }
  }
  const markdown=file=>/\.(md|markdown|txt)$/i.test(file.name);
  const image=file=>file.type.startsWith('image/')||/\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i.test(file.name);
  const hasFiles=event=>Array.from(event.dataTransfer?.types||[]).includes('Files');
  let opening=false;
  document.addEventListener('dragover',event=>{
    if(!hasFiles(event))return;
    event.preventDefault();event.dataTransfer.dropEffect='copy';
    hint.hidden=!Array.from(event.dataTransfer.items||[]).some(item=>item.kind==='file'&&!item.type.startsWith('image/'));
  },true);
  document.addEventListener('dragleave',event=>{if(!event.relatedTarget)hint.hidden=true;},true);
  window.addEventListener('blur',()=>{hint.hidden=true;});
  document.addEventListener('drop',event=>{
    hint.hidden=true;
    const files=Array.from(event.dataTransfer?.files||[]);if(!files.length)return;
    const documents=files.filter(markdown);
    if(!documents.length&&files.every(image)&&event.target.closest('#editor'))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(!documents.length){toast('请拖入 .md、.markdown 或 .txt 文件');return;}
    if(documents.length!==1){toast('请一次打开一个 Markdown 文件');return;}
    if(opening){toast('请先完成当前文件操作');return;}
    opening=true;
    (async()=>{
      const file=documents[0];
      if(file.size>8*1024*1024)throw new Error('文档不能超过 8 MiB');
      const content=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
      if(!await confirmDiscard())return;
      // HTML file drops do not reveal an absolute file path. Explicitly clear
      // the native save target so Ctrl+S cannot overwrite the previous file.
      let data={name:file.name,content};
      if(window.desktop?.importFile)data=await window.desktop.importFile(data);
      else if(window.desktop?.new)await window.desktop.new();
      await loadDocument(data);toast(window.desktop?'已导入，保存时请选择文件位置':'Markdown 已打开');
    })().catch(error=>showError('打开失败',error.message||error)).finally(()=>{opening=false;});
  },true);
}
