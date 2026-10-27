// WebView2's embedded about:blank page has no localStorage origin.
// Keep the same synchronous read API after one native hydration step.
const native = Boolean(window.desktop?.readState);
let values = {};
let onError = () => {};
const ready = native ? window.desktop.readState().then(state => { values = state || {}; }).catch(error => { console.error('读取本地草稿失败', error); }) : Promise.resolve();
const storage = {
  ready,
  set onError(handler) { onError = handler; },
  getItem(key) {
    if (native) return values[key] ?? null;
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem(key, value) {
    if (native) { values[key] = value; window.desktop.writeState(key, value).catch(onError); }
    else { try { localStorage.setItem(key, value); } catch (error) { onError(error); } }
  },
  removeItem(key) {
    if (native) { delete values[key]; window.desktop.writeState(key, null).catch(onError); }
    else { try { localStorage.removeItem(key); } catch (error) { onError(error); } }
  },
};
export default storage;
