// Native paths stay in the host queue until the complete editor can accept
// them. Pull one document at a time to avoid holding several large RPC payloads.
export function installExternalFiles({loadDocument,showError,isBusy=()=>false}) {
  if (!window.desktop?.nextOpenFile) return;
  let running=false,requested=false;
  const blocked=()=>isBusy()||document.querySelector('dialog[open]');
  async function drain() {
    requested=true;
    if(running||blocked())return;
    running=true;
    try {
      do {
        requested=false;
        while(!blocked()) {
          let data;
          try {data=await window.desktop.nextOpenFile();}
          catch(error){showError('打开失败',error.message||error);break;}
          if(!data)break;
          // A dialog may have opened during the RPC. Keep this one result
          // locally and defer applying it so an existing save prompt stays put.
          while(blocked())await new Promise(resolve=>setTimeout(resolve,50));
          try {await loadDocument(data);}
          catch(error){showError('打开失败',error.message||error);break;}
        }
      } while(requested&&!blocked());
    } finally {running=false;}
  }
  window.addEventListener('tekaku-open-files',drain);
  // Dialog close events run after close/save promises settle. A zero-delay
  // task also allows the tab-close guard to release its busy state.
  document.addEventListener('close',()=>setTimeout(drain,0),true);
  drain();
}
