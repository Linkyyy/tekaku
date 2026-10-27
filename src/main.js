import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from '@tiptap/markdown';
import './style.css';
import { extraExtensions, resetImageCache } from './editor-extensions';
import { installFeatures } from './features';
import storage from './storage.js';
import { installWindowFiles } from './window-files';
await storage.ready;

const blankDocument = { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 } }, { type: 'paragraph' }] };
const themes = [
  { id: 'white', name: '纯白', detail: '干净 · 明亮' },
  { id: 'paper', name: '纸笺', detail: '柔和 · 暖色' },
  { id: 'sage', name: '青苔', detail: '清新 · 护眼' },
  { id: 'night', name: '深夜', detail: '沉静 · 深色' },
];
let settings = { theme: 'white', startupFullscreen: true, startupSidebarCollapsed: true, showToolbar: false, showStatusbar: false, font: 'system', fontSize: 16, lineHeight: 1.9, contentWidth: 780 };
try {
  const saved = JSON.parse(storage.getItem('tekaku-settings') || 'null');
  if (themes.some(theme => theme.id === saved?.theme)) settings.theme = saved.theme;
  for (const key of ['startupFullscreen', 'startupSidebarCollapsed', 'showToolbar', 'showStatusbar']) if (typeof saved?.[key] === 'boolean') settings[key] = saved[key];
  if (['system', 'serif', 'mono'].includes(saved?.font)) settings.font = saved.font;
  for (const [key, min, max] of [['fontSize', 14, 24], ['lineHeight', 1.5, 2.4], ['contentWidth', 600, 1100]]) if (Number.isFinite(saved?.[key])) settings[key] = Math.min(max, Math.max(min, saved[key]));
} catch { /* Use white defaults if settings cannot be read. */ }
document.body.classList.toggle('sidebar-hidden', settings.startupSidebarCollapsed);
document.body.dataset.theme = settings.theme;
let stored = null;
try { const value = JSON.parse(storage.getItem('tekaku-draft') || 'null'); if (typeof value?.content === 'string' && typeof value?.name === 'string') stored = value; } catch { /* Ignore a damaged local draft. */ }
let fileName = stored?.name || '未命名.md';
let filePath = stored?.path || null;
let dirty = Boolean(stored);
let sourceMode = false;
let sourceBefore = '';
let activeSlash = false;
let slashIndex = 0;
let toastTimer;
let persistTimer;
let lastCountDocument;
let lastCountText;
let nativeTheme;
let features;
document.querySelector('#app').innerHTML = `
<aside class="sidebar" aria-label="侧边栏">
  <div class="brand"><span class="brand-mark">手</span><strong>手书 <small>TEKAKU</small></strong></div>
  <div class="sidebar-content">
    <button class="new-document" id="new">＋ <span>新建文档</span><kbd>⌘ N</kbd></button>
    <button class="nav-item selected" id="current"><span>▤</span><span id="sidebar-name"></span><span class="tiny-dot">•</span></button>
    <div class="section-label">文件</div>
    <button class="nav-item" id="open"><svg viewBox="0 0 20 20"><path d="M3 5h5l2 2h7v9H3Z"/></svg><span>打开文件</span><kbd>⌘ O</kbd></button>
    <button class="nav-item" id="save"><svg viewBox="0 0 20 20"><path d="M4 3h10l3 3v11H3V3Zm3 0v5h6V3M6 17v-6h8v6"/></svg><span>保存文档</span><kbd>⌘ S</kbd></button>
    <button class="nav-item" id="save-as"><svg viewBox="0 0 20 20"><path d="M9 3H3v14h14v-6M11 3h6v6M9 11l8-8"/></svg><span>另存为</span><kbd>⌘ ⇧ S</kbd></button>
    <div class="section-label">视图</div>
    <button class="nav-item" id="menu-source" aria-pressed="false"><svg viewBox="0 0 20 20"><path d="m7 5-5 5 5 5m6-10 5 5-5 5m-2-12-2 14"/></svg><span>Markdown 源码</span></button>
    <button class="nav-item" id="toggle-fullscreen"><svg viewBox="0 0 20 20"><path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4"/></svg><span>切换全屏</span><kbd>F11</kbd></button>
  </div>
  <div class="sidebar-bottom">
    <button class="nav-item" id="settings" aria-label="设置"><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="3"/><path d="m8 3 .7-1h2.6l.7 1 .6 1.3 1.4.5 1.5-.2 1.3 2.2-.8 1.3v2.8l.8 1.3-1.3 2.2-1.5-.2-1.4.5L12 17l-.7 1H8.7L8 17l-.6-1.3-1.4-.5-1.5.2-1.3-2.2.8-1.3V8.9l-.8-1.3 1.3-2.2 1.5.2 1.4-.5Z"/></svg><span>设置</span><kbd>Ctrl ,</kbd></button>
    <button class="nav-item" id="help"><svg viewBox="0 0 20 20"><rect x="2" y="5" width="16" height="10" rx="2"/><path d="M5 8h1m3 0h1m3 0h1M5 11h1m3 0h5"/></svg><span>快捷键</span></button>
  </div>
</aside>
<main>
  <header id="titlebar">
    <div class="breadcrumb"><button id="expand" aria-label="切换侧栏" title="切换侧栏"><svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" rx="2"/><path d="M8 4v12"/></svg></button><span id="filename"></span><span id="unsaved"></span></div>
    <div class="titlebar-drag-space" aria-hidden="true"></div>
    <span id="save-state"></span>
    <div class="window-controls"><button id="window-minimize" aria-label="最小化" title="最小化"><svg viewBox="0 0 16 16"><path d="M3 8.5h10"/></svg></button><button id="window-maximize" aria-label="还原窗口" title="还原窗口"><svg viewBox="0 0 16 16"><rect x="3.5" y="3.5" width="9" height="9" rx=".5"/></svg></button><button id="window-close" aria-label="关闭窗口" title="关闭窗口"><svg viewBox="0 0 16 16"><path d="m4 4 8 8m0-8-8 8"/></svg></button></div>
  </header>
  <div class="toolbar"><div class="toolbar-group"><button data-action="paragraph" title="正文">正文⌄</button><span class="toolbar-divider"></span><button data-action="bold" title="粗体 (Ctrl/Cmd+B)"><b>B</b></button><button data-action="italic" title="斜体"><i>I</i></button><button data-action="strike" title="删除线"><s>S</s></button><button data-action="code" title="行内代码">&lt;/&gt;</button><span class="toolbar-divider"></span><button data-action="heading" title="二级标题">H₂</button><button data-action="bulletList" title="无序列表">☷</button><button data-action="taskList" title="待办清单">☑</button><button data-action="blockquote" title="引用">❞</button><button data-action="undo" title="撤销">↶</button><button data-action="redo" title="重做">↷</button></div><button id="source" aria-label="切换 Markdown 源码" title="切换 Markdown 源码">Markdown <span>⌘ ⇧ M</span></button></div>
  <section class="page-scroll"><div class="paper"><div id="editor"></div><textarea id="source-editor" spellcheck="false" aria-label="Markdown 源码" hidden></textarea></div></section>
  <footer><div><span class="local-dot"></span><span id="status">所有内容仅保存在本地</span></div><div><span id="word-count"></span><span>UTF-8</span><span>Markdown</span></div></footer>
</main>
<div id="slash-menu" class="floating-menu" hidden><div class="menu-title">添加内容块</div><div id="slash-items"></div><div class="menu-hint">↑ ↓ 选择 · Enter 插入 · Esc 关闭</div></div>

<div id="toast" role="status"></div>
<dialog id="help-dialog"><button id="close-help" class="dialog-close">×</button><h2>快捷键</h2><p>Markdown 快捷输入会在空格后自动转换。</p><dl><dt># … ###### + 空格</dt><dd>一至六级标题</dd><dt>- / 1. + 空格</dt><dd>列表</dd><dt>[] + 空格</dt><dd>待办事项</dd><dt>&gt; + 空格</dt><dd>引用</dd><dt>\`\`\`python + 空格</dt><dd>带语言的代码块</dd><dt>Ctrl Alt C / Ctrl E</dt><dd>代码块 / 行内代码</dd><dt>Tab / Shift Tab</dt><dd>代码缩进 / 列表层级</dd><dt>代码末尾连按三次 Enter</dt><dd>退出代码块</dd><dt>Ctrl Shift M</dt><dd>Markdown 源码</dd><dt>/</dt><dd>内容块菜单</dd><dt>Ctrl / ⌘ + O / S / N</dt><dd>打开 / 保存 / 新建</dd></dl><p class="help-note">代码仅作文本编辑与高亮显示。源码模式也可用 Tab / Shift Tab 调整缩进。</p></dialog>
<dialog id="settings-dialog" aria-labelledby="settings-title">
  <div class="settings-heading"><div><span class="eyebrow">TEKAKU</span><h2 id="settings-title">设置</h2></div><button id="close-settings" aria-label="关闭设置"><svg viewBox="0 0 20 20"><path d="m5 5 10 10m0-10L5 15"/></svg></button></div>
  <section class="settings-section"><h3>外观</h3><p>选择适合你的写作空间。</p><div class="theme-options" role="group" aria-label="皮肤">${themes.map(theme => `<button class="theme-option" data-theme-choice="${theme.id}" aria-pressed="false"><span class="theme-preview preview-${theme.id}"><span></span><i></i><i></i></span><strong>${theme.name}</strong><small>${theme.detail}</small><span class="theme-check">✓</span></button>`).join('')}</div></section>
  <section class="settings-section"><h3>编辑器</h3>
    <label class="setting-row"><span>字体</span><select id="setting-font"><option value="system">系统字体</option><option value="serif">衬线字体</option><option value="mono">等宽字体</option></select></label>
    <label class="setting-row"><span>字号 <output id="font-size-value"></output></span><input id="setting-font-size" type="range" min="14" max="24" step="1"></label>
    <label class="setting-row"><span>行距 <output id="line-height-value"></output></span><input id="setting-line-height" type="range" min="1.5" max="2.4" step="0.1"></label>
    <label class="setting-row"><span>正文宽度 <output id="content-width-value"></output></span><input id="setting-content-width" type="range" min="600" max="1100" step="20"></label>
    <label class="setting-row"><span>显示格式工具栏</span><span class="switch"><input id="show-toolbar" type="checkbox"><span></span></span></label>
    <label class="setting-row"><span>显示字数与状态栏</span><span class="switch"><input id="show-statusbar" type="checkbox"><span></span></span></label>
  </section>
  <section class="settings-section"><h3>启动</h3>
    <label class="setting-row"><span>启动时全屏 <small>F11 切换，Esc 退出</small></span><span class="switch"><input id="startup-fullscreen" type="checkbox"><span></span></span></label>
    <label class="setting-row"><span>启动时收起侧栏</span><span class="switch"><input id="startup-sidebar" type="checkbox"><span></span></span></label>
  </section>
  <div class="settings-footer"><button id="reset-settings">恢复默认设置</button><span>手书 0.7.0 · 自动保存</span></div>
</dialog>
<dialog id="confirm-dialog" class="message-dialog" aria-labelledby="confirm-title"><h2 id="confirm-title">保存修改？</h2><p id="confirm-message"></p><div class="dialog-actions"><button id="confirm-cancel">取消</button><button id="confirm-discard">不保存</button><button id="confirm-save" class="primary-button">保存</button></div></dialog>
<dialog id="error-dialog" class="message-dialog" aria-labelledby="error-title"><h2 id="error-title">操作失败</h2><p id="error-message"></p><div class="dialog-actions"><button id="error-close" class="primary-button">知道了</button></div></dialog>
<input id="file-input" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden>`;
const $ = (selector) => document.querySelector(selector);
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3000); }
function markdown() { return sourceMode ? $('#source-editor').value : editor.getMarkdown(); }
function persist() { clearTimeout(persistTimer); storage.setItem('tekaku-draft', JSON.stringify({ name: fileName, path: filePath, content: markdown() })); }
function schedulePersist() { clearTimeout(persistTimer); persistTimer = setTimeout(persist, 600); }
storage.onError = () => toast('本地草稿写入失败，请保存文档到文件');
function updateState(changed = false) {
  if (changed) { if (!dirty) window.desktop?.dirty(true); dirty = true; schedulePersist(); }
  $('#filename').textContent = fileName;
  $('#sidebar-name').textContent = fileName.replace(/\.(md|markdown)$/i, '');
  $('#unsaved').textContent = dirty ? '•' : '';
  $('#save-state').textContent = dirty ? '未保存' : '已保存';
  if (settings.showStatusbar && (sourceMode ? lastCountText !== $('#source-editor').value : lastCountDocument !== editor.state.doc)) {
    const text = sourceMode ? markdown() : editor.getText();
    $('#word-count').textContent = `${text.replace(/\s/g, '').length.toLocaleString()} 字`;
    lastCountDocument = sourceMode ? null : editor.state.doc;
    lastCountText = sourceMode ? text : null;
  }
  document.title = `${dirty ? '• ' : ''}${fileName} — 手书`;
  document.querySelectorAll('[data-action]').forEach(button => button.classList.toggle('active', button.dataset.action === 'heading' ? editor.isActive('heading', { level: 2 }) : editor.isActive(button.dataset.action)));
}
const commands = [
  ['正文', '普通的文字段落', 'T', chain => chain.setParagraph()],
  ['一级标题', '清晰有力的大标题', 'H₁', chain => chain.setHeading({ level: 1 })],
  ['二级标题', '为内容划分章节', 'H₂', chain => chain.setHeading({ level: 2 })],
  ['三级标题', '细分你的想法', 'H₃', chain => chain.setHeading({ level: 3 })],
  ['四级标题', '更细一层的内容', 'H₄', chain => chain.setHeading({ level: 4 })],
  ['五级标题', '组织细节', 'H₅', chain => chain.setHeading({ level: 5 })],
  ['六级标题', '补充说明', 'H₆', chain => chain.setHeading({ level: 6 })],
  ['无序列表', '有条理地记录', '☷', chain => chain.toggleBulletList()],
  ['有序列表', '一步一步，慢慢来', '1.', chain => chain.toggleOrderedList()],
  ['待办清单', '让想法付诸行动', '☑', chain => chain.toggleTaskList()],
  ['引用', '留下一句值得记住的话', '❞', chain => chain.toggleBlockquote()],
  ['代码块', '写下一段代码', '</>', chain => chain.toggleCodeBlock()],
  ['分割线', '分隔内容', '—', chain => chain.setHorizontalRule()],
  ['图片', '插入本地或网络图片', '▧', chain => { features.imageDialog(); return chain; }],
  ['表格', '三行三列表格', '▦', chain => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true })],
  ['链接', '编辑链接地址', '↗', chain => { features.linkDialog(); return chain; }],
];
const editor = new Editor({
  element: $('#editor'),
  extensions: [StarterKit.configure({ codeBlock: false, link: { openOnClick: false }, undoRedo: { depth: 40 } }), Placeholder.configure({ showOnlyCurrent: false, placeholder: ({ node }) => node.type.name === 'heading' && node.attrs.level === 1 ? '请输入标题' : '写点什么，或输入 / 添加内容…' }), TaskList, TaskItem.configure({ nested: true }), ...extraExtensions, Markdown],
  content: stored?.content ?? blankDocument, contentType: stored ? 'markdown' : 'json',
  editorProps: {
    attributes: { 'aria-label': '文档编辑器', spellcheck: 'false' },
    handleKeyDown(view, event) {
      if (event.isComposing) return false;
      if (activeSlash && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
        event.preventDefault();
        if (event.key === 'Escape') closeSlash();
        else if (event.key === 'Enter') runSlash(slashIndex);
        else { slashIndex = (slashIndex + (event.key === 'ArrowDown' ? 1 : -1) + commands.length) % commands.length; renderSlash(); }
        return true;
      }
      return false;
    },
  },
  onUpdate() { updateState(true); updateSlash(); features?.onUpdate(); },
  onSelectionUpdate() { updateState(); updateSlash(); },
});
function closeSlash() { activeSlash = false; $('#slash-menu').hidden = true; }
function renderSlash() {
  $('#slash-items').innerHTML = commands.map(([title, desc, icon], index) => `<button class="slash-item ${index === slashIndex ? 'chosen' : ''}" data-command="${index}"><span class="block-icon">${icon.replace('<', '&lt;')}</span><span><strong>${title}</strong><small>${desc}</small></span></button>`).join('');
  $('#slash-items').querySelector('.chosen')?.scrollIntoView({ block: 'nearest' });
}
function updateSlash() {
  const { $from, empty } = editor.state.selection;
  if (!empty || $from.parent.textContent !== '/' || !$from.parent.isTextblock) { closeSlash(); return; }
  if (!activeSlash) slashIndex = 0;
  activeSlash = true; renderSlash(); $('#slash-menu').hidden = false;
  const rect = editor.view.coordsAtPos(editor.state.selection.from);
  $('#slash-menu').style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 300))}px`;
  $('#slash-menu').style.top = `${Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 420))}px`;
}
function runSlash(index) {
  const { $from } = editor.state.selection;
  const from = $from.start();
  closeSlash(); const chain = editor.chain().focus().deleteRange({ from, to: from + 1 });
  if (commands[index][0] === '图片' || commands[index][0] === '链接') { chain.run(); if (commands[index][0] === '图片') features.imageDialog(); else features.linkDialog(); }
  else commands[index][3](chain).run();
}
$('#slash-items').addEventListener('mousedown', event => { const button = event.target.closest('[data-command]'); if (button) { event.preventDefault(); runSlash(Number(button.dataset.command)); } });
function exitSource() { if (!sourceMode) return; if ($('#source-editor').value !== sourceBefore) editor.commands.setContent($('#source-editor').value, { contentType: 'markdown' }); sourceMode = false; $('#source-editor').value = ''; sourceBefore = ''; $('#source-editor').hidden = true; $('#editor').hidden = false; $('#source').classList.remove('active'); $('#menu-source').setAttribute('aria-pressed', 'false'); features?.sourceChanged(); }
function toggleSource() { closeSlash(); if (sourceMode) exitSource(); else { sourceBefore = editor.getMarkdown(); $('#source-editor').value = sourceBefore; sourceMode = true; $('#source-editor').hidden = false; $('#editor').hidden = true; $('#source').classList.add('active'); $('#menu-source').setAttribute('aria-pressed', 'true'); $('#source-editor').focus(); } updateState(); features?.sourceChanged(); }
let pendingConfirmation;
function showError(title, message) {
  $('#error-title').textContent = title; $('#error-message').textContent = String(message);
  if (!$('#error-dialog').open) $('#error-dialog').showModal();
}
$('#error-close').onclick = () => $('#error-dialog').close();
function confirmDiscard() {
  if (!dirty) return true;
  if (pendingConfirmation) return pendingConfirmation;
  const dialog = $('#confirm-dialog');
  let resolveDecision;
  const decision = new Promise(resolve => { resolveDecision = resolve; });
  pendingConfirmation = decision;
  let finished = false;
  let saving = false;
  const finish = result => {
    if (finished) return;
    finished = true;
    // Clear before hiding the dialog, so another close request can immediately
    // create its own confirmation after a canceled native save dialog.
    if (pendingConfirmation === decision) pendingConfirmation = null;
    dialog.removeEventListener('cancel', cancel);
    dialog.removeEventListener('close', closed);
    dialog.close();
    resolveDecision(result);
  };
  const cancel = event => { event.preventDefault(); if (!saving) finish(false); };
  // A previous close event may be queued when a new confirmation has already
  // opened. Only settle this decision if this dialog is actually closed.
  const closed = () => { if (!dialog.open) finish(false); };
  dialog.addEventListener('cancel', cancel);
  dialog.addEventListener('close', closed);
  $('#confirm-message').textContent = `“${fileName}”有未保存的修改。`;
  $('#confirm-cancel').onclick = () => finish(false);
  $('#confirm-discard').onclick = () => finish(true);
  $('#confirm-save').onclick = async () => {
    saving = true;
    dialog.querySelectorAll('button').forEach(button => { button.disabled = true; });
    const saved = await saveDocument();
    dialog.querySelectorAll('button').forEach(button => { button.disabled = false; });
    saving = false;
    finish(saved);
  };
  dialog.showModal(); $('#confirm-save').focus();
  return decision;
}
async function newDocument() {
  try {
    if (!await confirmDiscard()) return;
    if (window.desktop && !await window.desktop.new()) return;
    sourceMode = false; $('#source-editor').hidden = true; $('#editor').hidden = false; $('#source').classList.remove('active'); $('#menu-source').setAttribute('aria-pressed', 'false');
    clearTimeout(persistTimer); resetImageCache();
    editor.commands.setContent(blankDocument, { contentType: 'json', emitUpdate: false }); fileName = '未命名.md'; filePath = null; dirty = false; storage.removeItem('tekaku-draft'); window.desktop?.dirty(false); updateState(); features?.onLoad(); editor.commands.focus('start');
  } catch (error) { showError('新建失败', error.message || error); }
}
async function loadDocument(data) {
  if (!data) return;
  sourceMode = false; $('#source-editor').hidden = true; $('#editor').hidden = false; $('#source').classList.remove('active'); $('#menu-source').setAttribute('aria-pressed', 'false');
  resetImageCache();
  editor.commands.setContent(data.content, { contentType: 'markdown', emitUpdate: false }); fileName = data.name; filePath = data.path || null; dirty = false;
  window.desktop?.dirty(false); persist(); updateState(); features?.onLoad(); toast('文档已打开');
}
async function openDocument() {
  try {
    if (!await confirmDiscard()) return;
    if (window.desktop) await loadDocument(await window.desktop.open());
    else $('#file-input').click();
  } catch (error) { showError('打开失败', error.message || error); }
}
async function saveDocument(saveAs = false) {
  try {
    const content = markdown();
    if (window.desktop) { const result = await window.desktop.save({ content, saveAs }); if (!result) return false; fileName = result.name; filePath = result.path || filePath;
      if (typeof result.content === 'string' && result.content !== content) {
        resetImageCache();
        if (sourceMode) $('#source-editor').value = result.content;
        else editor.commands.setContent(result.content, { contentType: 'markdown', emitUpdate: false });
        features?.onLoad();
      } }
    else { const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    dirty = false; persist(); updateState(); toast(window.desktop ? '文档已保存' : 'Markdown 文件已导出'); return true;
  } catch (error) { showError('保存失败', error.message || error); return false; }
}
$('#new').onclick = newDocument;
$('#open').onclick = openDocument;
$('#save').onclick = () => saveDocument();
$('#save-as').onclick = () => saveDocument(true);
$('#file-input').onchange = async event => { const file = event.target.files[0]; if (file) await loadDocument({ name: file.name, content: await file.text() }); event.target.value = ''; };
$('#source').onclick = toggleSource;
$('#menu-source').onclick = toggleSource;
$('#source-editor').oninput = () => { updateState(true); features?.sourceChanged(); };
function toggleSidebar() {
  const collapsed = document.body.classList.toggle('sidebar-hidden');
  $('#expand').setAttribute('aria-expanded', String(!collapsed));
  $('#expand').title = collapsed ? '展开侧栏' : '收起侧栏';
}
$('#expand').onclick = toggleSidebar;
$('#expand').setAttribute('aria-expanded', String(!document.body.classList.contains('sidebar-hidden')));
$('#expand').title = document.body.classList.contains('sidebar-hidden') ? '展开侧栏' : '收起侧栏';
$('#current').onclick = () => editor.commands.focus();
function syncSettings() {
  document.body.dataset.theme = settings.theme;
  if (window.desktop?.window && nativeTheme !== settings.theme) {
    nativeTheme = settings.theme;
    Promise.resolve(window.desktop.window(`theme-${settings.theme}`)).catch(() => { nativeTheme = null; });
  }
  document.body.classList.toggle('show-toolbar', settings.showToolbar);
  document.body.classList.toggle('show-statusbar', settings.showStatusbar);
  document.body.style.setProperty('--editor-font-size', `${settings.fontSize}px`);
  document.body.style.setProperty('--editor-line-height', settings.lineHeight);
  document.body.style.setProperty('--content-width', `${settings.contentWidth}px`);
  document.body.dataset.font = settings.font;
  document.querySelectorAll('[data-theme-choice]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === settings.theme));
  });
  $('#startup-fullscreen').checked = settings.startupFullscreen;
  $('#startup-sidebar').checked = settings.startupSidebarCollapsed;
  $('#show-toolbar').checked = settings.showToolbar;
  $('#show-statusbar').checked = settings.showStatusbar;
  $('#setting-font').value = settings.font;
  $('#setting-font-size').value = settings.fontSize;
  $('#setting-line-height').value = settings.lineHeight;
  $('#setting-content-width').value = settings.contentWidth;
  $('#font-size-value').textContent = `${settings.fontSize}px`;
  $('#line-height-value').textContent = settings.lineHeight.toFixed(1);
  $('#content-width-value').textContent = `${settings.contentWidth}px`;
  if (settings.showStatusbar) updateState();
}
function saveSettings() { storage.setItem('tekaku-settings', JSON.stringify(settings)); }
function openSettings() { syncSettings(); $('#settings-dialog').showModal(); }
$('#settings').onclick = openSettings;
$('#close-settings').onclick = () => $('#settings-dialog').close();
$('#settings-dialog').addEventListener('click', event => { if (event.target === $('#settings-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
document.querySelectorAll('[data-theme-choice]').forEach(button => button.onclick = () => {
  settings.theme = button.dataset.themeChoice; syncSettings(); saveSettings();
});
for (const [id, key] of [['startup-fullscreen', 'startupFullscreen'], ['startup-sidebar', 'startupSidebarCollapsed'], ['show-toolbar', 'showToolbar'], ['show-statusbar', 'showStatusbar']]) $(`#${id}`).onchange = event => { settings[key] = event.target.checked; syncSettings(); saveSettings(); };
$('#setting-font').onchange = event => { settings.font = event.target.value; syncSettings(); saveSettings(); };
for (const [id, key] of [['setting-font-size', 'fontSize'], ['setting-line-height', 'lineHeight'], ['setting-content-width', 'contentWidth']]) $(`#${id}`).oninput = event => { settings[key] = Number(event.target.value); syncSettings(); saveSettings(); };
$('#reset-settings').onclick = () => { settings = { theme: 'white', startupFullscreen: true, startupSidebarCollapsed: true, showToolbar: false, showStatusbar: false, font: 'system', fontSize: 16, lineHeight: 1.9, contentWidth: 780 }; syncSettings(); saveSettings(); };

syncSettings();
let nativeFullscreen = Boolean(window.desktop?.window);
function syncWindowState(state) {
  if (!state) return;
  nativeFullscreen = state.fullscreen;
  const restore = state.fullscreen || state.maximized;
  $('#window-maximize').setAttribute('aria-label', restore ? '还原窗口' : '最大化窗口');
  $('#window-maximize').title = restore ? '还原窗口' : '最大化窗口';
  document.body.classList.toggle('is-fullscreen', Boolean(state.fullscreen));
  document.body.classList.toggle('is-maximized', Boolean(state.maximized));
}
async function windowAction(action) {
  try {
    if (window.desktop?.window) syncWindowState(await window.desktop.window(action));
    else if (action === 'fullscreen' || action === 'exit-fullscreen') {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (action === 'fullscreen') await document.documentElement.requestFullscreen();
    }
  } catch (error) { toast(`窗口操作失败：${error.message || error}`); }
}
if (!window.desktop?.window) $('.window-controls').hidden = true;
$('#window-minimize').onclick = () => windowAction('minimize');
$('#window-maximize').onclick = () => windowAction('maximize');
$('#window-close').onclick = () => windowAction('close');
$('#toggle-fullscreen').onclick = () => windowAction('fullscreen');
let dragStart;
$('#titlebar').addEventListener('pointerdown', event => {
  if (event.button === 0 && !event.target.closest('button, input, a')) dragStart = { x: event.screenX, y: event.screenY };
});
$('#titlebar').addEventListener('pointermove', event => {
  if (dragStart && event.buttons === 1 && Math.hypot(event.screenX - dragStart.x, event.screenY - dragStart.y) > 4) { dragStart = null; windowAction('drag'); }
});
window.addEventListener('pointerup', () => { dragStart = null; });
$('#titlebar').addEventListener('dblclick', event => { if (!event.target.closest('button, input, a')) windowAction('maximize'); });
document.addEventListener('keydown', event => {
  if (event.defaultPrevented) return;
  if (event.key === 'F11') { event.preventDefault(); windowAction('fullscreen'); }
  if (event.key === 'Escape' && !document.querySelector('dialog[open]') && !activeSlash && nativeFullscreen) { event.preventDefault(); windowAction('exit-fullscreen'); }
  if ((event.ctrlKey || event.metaKey) && event.key === ',') { event.preventDefault(); if (!$('#settings-dialog').open) openSettings(); }
});
$('#help').onclick = () => $('#help-dialog').showModal();
$('#close-help').onclick = () => $('#help-dialog').close();
document.addEventListener('click', event => { if (!event.target.closest('#slash-menu') && !event.target.closest('.tiptap')) closeSlash(); });
document.querySelector('.toolbar-group').onmousedown = event => {
  const button = event.target.closest('[data-action]'); if (!button) return; event.preventDefault(); exitSource();
  const chain = editor.chain().focus();
  const actions = { paragraph: () => chain.setParagraph(), heading: () => chain.toggleHeading({ level: 2 }), bold: () => chain.toggleBold(), italic: () => chain.toggleItalic(), strike: () => chain.toggleStrike(), code: () => chain.toggleCode(), bulletList: () => chain.toggleBulletList(), taskList: () => chain.toggleTaskList(), blockquote: () => chain.toggleBlockquote(), undo: () => chain.undo(), redo: () => chain.redo() };
  actions[button.dataset.action]().run(); updateState();
};
document.addEventListener('keydown', event => {
  if (!(event.metaKey || event.ctrlKey)) return;
  const key = event.key.toLowerCase();
  if (['s', 'o', 'n'].includes(key) || (key === 'm' && event.shiftKey)) { event.preventDefault(); if (key === 's') saveDocument(event.shiftKey); if (key === 'o') openDocument(); if (key === 'n') newDocument(); if (key === 'm') toggleSource(); }
});
window.addEventListener('tekaku-close-request', async () => { if (await confirmDiscard()) windowAction('close-confirmed'); });
window.addEventListener('beforeunload', event => { if (dirty && !window.desktop) { event.preventDefault(); event.returnValue = ''; } });
features = installFeatures({ editor, exitSource, isSource: () => sourceMode, sourceField: () => $('#source-editor'), fileName: () => fileName, showError, toast });
installWindowFiles({ confirmDiscard, loadDocument, showError, toast, windowAction });
updateState(); await window.desktop?.dirty(dirty);
if (window.desktop?.initialFile) {
  try { const initial = await window.desktop.initialFile(false); if (initial && await confirmDiscard()) await loadDocument(await window.desktop.initialFile(true)); } catch (error) { showError('打开失败', error.message || error); }
}
window.addEventListener('blur', () => { if (dirty) persist(); });
window.addEventListener('pagehide', () => { if (dirty) persist(); });
if (!/Mac|iPhone|iPad/.test(navigator.platform)) {
  document.querySelectorAll('kbd, #source span').forEach(label => { label.textContent = label.textContent.replaceAll('⌘', 'Ctrl').replaceAll('⇧', 'Shift'); });
}

if (window.desktop?.window) windowAction('state');
