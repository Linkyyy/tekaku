const groups = [
  ['文件', [['新建文档',['Ctrl','N']],['打开文件',['Ctrl','O']],['保存',['Ctrl','S']],['另存为',['Ctrl','Shift','S']]]],
  ['编辑', [['粗体 / 斜体',['Ctrl','B / I']],['行内代码',['Ctrl','E']],['代码块',['Ctrl','Alt','C']],['撤销 / 重做',['Ctrl','Z / Shift Z']]]],
  ['查找与插入', [['查找 / 替换',['Ctrl','F / H']],['插入链接',['Ctrl','K']],['插入图片',['Ctrl','Shift','I']],['右键菜单',['Shift','F10']]]],
  ['视图', [['切换源码',['Ctrl','Shift','M']],['进入 / 退出全屏',['F11']],['打开设置',['Ctrl',',']],['退出全屏 / 关闭菜单',['Esc']]]],
];
export function shortcutGuide() {
  return `<dialog id="help-dialog" aria-labelledby="help-title"><div class="help-heading"><div class="help-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h1m4 0h1m4 0h1M6 13h1m4 0h1m4 0h1M8 16h8"/></svg></div><div><span class="eyebrow">TEKAKU · QUICK REFERENCE</span><h2 id="help-title">快捷键</h2></div><button id="close-help" aria-label="关闭快捷键指南"><svg viewBox="0 0 20 20"><path d="m5 5 10 10m0-10L5 15"/></svg></button></div><div class="shortcut-grid">${groups.map(([title,rows])=>`<section class="shortcut-group"><h3>${title}</h3><dl>${rows.map(([label,keys])=>`<div><dt>${label}</dt><dd>${keys.map(key=>`<kbd>${key}</kbd>`).join('')}</dd></div>`).join('')}</dl></section>`).join('')}</div><section class="markdown-cheats"><h3>Markdown 快捷输入</h3><div>${[['# … ######','一至六级标题'],['- / 1.','无序 / 有序列表'],['[]','待办清单'],['>','引用'],['```python','带语言的代码块'],['/','内容块菜单']].map(([keys,label])=>`<span><code>${keys.replace('>','&gt;')}</code><small>${label}</small></span>`).join('')}</div></section><p class="help-footer">块标记后按空格转换 · 代码与列表中用 Tab / Shift+Tab 调整缩进 · Esc 关闭</p></dialog>`;
}
