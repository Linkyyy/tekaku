import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import { lowlight } from './code-languages';
import { indentation } from './editing';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { closeHistory } from '@tiptap/pm/history';

const RichCodeBlock = CodeBlockLowlight.extend({
  renderMarkdown(node) {
    const text = (node.content || []).map(child => child.text || '').join('');
    let longest = 2;
    for (const match of text.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
    const fence = '`'.repeat(longest + 1);
    const language = String(node.attrs?.language || '').replace(/[\r\n`]/g, '');
    return `${fence}${language}\n${text}\n${fence}`;
  },
  addKeyboardShortcuts() {
    const indent = reverse => {
      const { state, view } = this.editor;
      const { $from, $to, from, to } = state.selection;
      if ($from.parent.type !== this.type || !$from.sameParent($to)) return false;
      const offset = $from.start();
      const edit = indentation($from.parent.textContent, from - offset, to - offset, reverse);
      if (!edit) return true;
      const tr = closeHistory(state.tr.insertText(edit.insert, offset + edit.from, offset + edit.to));
      tr.setSelection(TextSelection.create(tr.doc, offset + edit.anchor, offset + edit.head));
      view.dispatch(tr.scrollIntoView());
      return true;
    };
    return { ...this.parent?.(), Tab: () => indent(false), 'Shift-Tab': () => indent(true) };
  },
}).configure({ lowlight, defaultLanguage: 'plaintext' });
const imageCache = new Map();
export function resetImageCache() { imageCache.clear(); }
export async function imageSource(src) {
  if (/^(data:image\/|https?:\/\/)/i.test(src)) return src;
  if (!window.desktop?.resolveImages) return '';
  if (!imageCache.has(src)) imageCache.set(src, window.desktop.resolveImages([src]).then(result => result[src] || '').catch(() => ''));
  return imageCache.get(src);
}
const RichImage = Image.extend({
  renderMarkdown(node) {
    const src = String(node.attrs.src || '').replaceAll('>', '%3E').replaceAll('<', '%3C');
    const alt = String(node.attrs.alt || '').replace(/[\\\[\]]/g, '\\$&').replaceAll('\n', ' ');
    const title = node.attrs.title ? ` "${String(node.attrs.title).replace(/[\\"]/g, '\\$&').replaceAll('\n', ' ')}"` : '';
    return `![${alt}](${/[\s()]/.test(src) ? `<${src}>` : src}${title})`;
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('figure'); dom.className = 'image-node'; dom.contentEditable = 'false';
      const img = document.createElement('img'); img.draggable = false; img.decoding = 'async';
      const error = document.createElement('figcaption'); error.textContent = '图片无法读取：请检查路径或网络连接'; error.hidden = true;
      dom.append(img, error);
      let version = 0;
      const update = current => {
        const own = ++version; img.alt = current.attrs.alt || ''; img.title = current.attrs.title || ''; error.hidden = true;
        imageSource(current.attrs.src || '').then(src => {
          if (own !== version) return;
          if (!src) { img.removeAttribute('src'); error.hidden = false; return; }
          img.onerror = () => { error.hidden = false; }; img.onload = () => { error.hidden = true; };
          img.src = src;
        });
      };
      update(node);
      return { dom, update: current => { if (current.type.name !== 'image') return false; update(current); return true; }, destroy: () => { version++; } };
    };
  },
}).configure({ allowBase64: true });

export function literalMatches(text, query, sensitive = false) {
  if (!query) return [];
  const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), sensitive ? 'gu' : 'giu');
  const matches = [];
  for (const match of text.matchAll(re)) { matches.push({ from: match.index, to: match.index + match[0].length }); if (matches.length >= 10000) break; }
  return matches;
}
export function documentMatches(doc, query, sensitive) {
  const result = [];
  if (!query) return result;
  doc.descendants((node, pos) => {
    if (result.length >= 10000) return false;
    if (!node.isTextblock) return;
    // Current inline leaf nodes have size one, matching the placeholder in textBetween.
    const text = node.textBetween(0, node.content.size, '', '\uFFFC');
    for (const match of literalMatches(text, query, sensitive)) {
      if (result.length >= 10000) break;
      result.push({ from: pos + 1 + match.from, to: pos + 1 + match.to });
    }
    return false;
  });
  return result;
}
const searchKey = new PluginKey('documentSearch');
export const Search = Extension.create({
  name: 'documentSearch',
  addStorage() { return { query: '', sensitive: false, active: 0, matches: [] }; },
  addProseMirrorPlugins() {
    const storage = this.storage;
    return [new Plugin({ key: searchKey, state: {
      init: () => DecorationSet.empty,
      apply(tr, previous) {
        if (!tr.docChanged && !tr.getMeta('documentSearch')) return previous.map(tr.mapping, tr.doc);
        storage.matches = documentMatches(tr.doc, storage.query, storage.sensitive);
        storage.active = Math.min(storage.active, Math.max(0, storage.matches.length - 1));
        return DecorationSet.create(tr.doc, storage.matches.map((match, i) => Decoration.inline(match.from, match.to, { class: i === storage.active ? 'search-match search-current' : 'search-match' })));
      },
    }, props: { decorations: state => searchKey.getState(state) } })];
  },
});
const ListIndent = Extension.create({
  name: 'listIndent', priority: 50,
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.sinkListItem(this.editor.isActive('taskItem') ? 'taskItem' : 'listItem'),
      'Shift-Tab': () => this.editor.commands.liftListItem(this.editor.isActive('taskItem') ? 'taskItem' : 'listItem'),
    };
  },
});
export const extraExtensions = [RichImage, TableKit.configure({ table: { resizable: true, allowTableNodeSelection: true } }), RichCodeBlock, Highlight, Search, ListIndent];
