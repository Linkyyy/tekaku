const groups = [
  ['文件', [['新建文档',['Ctrl','N']],['打开文件',['Ctrl','O']],['保存',['Ctrl','S']],['另存为',['Ctrl','Shift','S']]]],
  ['编辑', [['粗体 / 斜体',['Ctrl','B / I']],['行内代码',['Ctrl','E']],['代码块',['Ctrl','Alt','C']],['撤销 / 重做',['Ctrl','Z / Shift Z']]]],
  ['查找与插入', [['查找 / 替换',['Ctrl','F / H']],['插入链接',['Ctrl','K']],['插入图片',['Ctrl','Shift','I']],['右键菜单',['Shift','F10']]]],
  ['视图', [['切换源码',['Ctrl','Shift','M']],['进入 / 退出全屏',['F11']],['打开设置',['Ctrl',',']],['退出全屏 / 关闭菜单',['Esc']]]],
];

const escape = text => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const markdownGroups = [
  ['段落与内容块', [
    ['标题', '# 标题', '标记后按空格；# 至 ###### 对应一至六级', '<strong class="guide-heading-example">标题</strong>'],
    ['无序列表', '- 列表项', '输入 - 后按空格', '<span>•　列表项</span>'],
    ['有序列表', '1. 列表项', '输入 1. 后按空格', '<span>1.　列表项</span>'],
    ['待办清单', '[] 任务', '输入 [] 后按空格', '<span class="guide-task"><span aria-hidden="true"></span>任务</span>'],
    ['引用', '> 引用文字', '输入 > 后按空格', '<blockquote>引用文字</blockquote>'],
    ['代码块', '```python', '语言名后按空格，再输入代码', '<pre><span>Python</span><code>print("hello")</code></pre>'],
    ['分割线', '---', '在空段落连续输入三个 -', '<hr>'],
    ['内容块菜单', '/', '空段落输入 /，方向键选择，Enter 插入', '<span class="guide-menu-example">＋　添加内容块</span>'],
  ]],
  ['文字样式', [
    ['粗体', '**重点**', '输入成对的标记包住文字', '<strong>重点</strong>'],
    ['斜体', '*强调*', '输入成对的标记包住文字', '<em>强调</em>'],
    ['删除线', '~~已完成~~', '输入成对的标记包住文字', '<s>已完成</s>'],
    ['行内代码', '`code`', '输入成对的反引号', '<code class="guide-inline-code">code</code>'],
  ]],
  ['源码示例', [
    ['链接', '[名称](https://example.com)', '在源码视图输入，切回预览查看', '<span class="guide-link-example">名称 ↗</span>'],
    ['图片', '![说明](图片.png)', '也可右键 → 插入内容 → 图片', '<span class="guide-image-example">▧　图片说明</span>'],
    ['表格', '| 名称 | 状态 |\n| --- | --- |\n| 手书 | 完成 |', '在源码视图输入，或使用右键插入', '<table><tr><th>名称</th><th>状态</th></tr><tr><td>手书</td><td>完成</td></tr></table>'],
  ]],
];
export function shortcutGuide() {
  return `<dialog id="help-dialog" class="scroll-dialog" aria-labelledby="help-title">
    <div class="help-heading"><div class="help-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h1m4 0h1m4 0h1M6 13h1m4 0h1m4 0h1M8 16h8"/></svg></div><h2 id="help-title">输入指南</h2><button id="close-help" aria-label="关闭快捷键指南"><svg viewBox="0 0 20 20"><path d="m5 5 10 10m0-10L5 15"/></svg></button></div>
    <div class="guide-tabs" role="tablist" aria-label="指南分类"><button id="guide-shortcuts" data-guide-tab role="tab" aria-selected="true" aria-controls="shortcuts-panel">快捷键</button><button id="guide-markdown" data-guide-tab role="tab" aria-selected="false" aria-controls="markdown-panel" tabindex="-1">Markdown 快捷输入</button></div>
    <div id="help-body" class="dialog-body" tabindex="0" aria-label="指南内容">
      <section id="shortcuts-panel" role="tabpanel" aria-labelledby="guide-shortcuts"><div class="shortcut-grid">${groups.map(([title,rows])=>`<section class="shortcut-group"><h3>${title}</h3><dl>${rows.map(([label,keys])=>`<div><dt>${label}</dt><dd>${keys.map(key=>`<kbd>${key}</kbd>`).join('')}</dd></div>`).join('')}</dl></section>`).join('')}</div></section>
      <section id="markdown-panel" class="markdown-guide" role="tabpanel" aria-labelledby="guide-markdown" hidden><p class="guide-intro">左边看写法，右边看效果。段落标记在行首输入，按空格转换。</p>${markdownGroups.map(([title,rows])=>`<section class="markdown-guide-group"><h3>${title}</h3><div class="guide-column-labels" aria-hidden="true"><span>输入示例</span><span>显示效果</span></div>${rows.map(([label,input,hint,preview])=>`<div class="markdown-guide-row"><div class="guide-input"><strong>${label}</strong><code>${escape(input)}</code><small>${escape(hint)}</small></div><div class="guide-result" aria-label="${label}显示效果">${preview}</div></div>`).join('')}</section>`).join('')}</section>
    </div><p class="help-footer"><span>Ctrl+Shift+M 切换源码</span><span>Esc 关闭指南</span></p>
  </dialog>`;
}
