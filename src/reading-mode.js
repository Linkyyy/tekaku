import Placeholder from '@tiptap/extension-placeholder';

export function documentPlaceholder(hint = '开始写点什么…') {
  return Placeholder.configure({
    showOnlyCurrent: true,
    showOnlyWhenEditable: true,
    placeholder: ({node}) => node.type.name === 'heading' && node.attrs.level === 1
      ? '请输入标题' : node.type.name === 'paragraph' ? hint : '',
  });
}

// Reading permits selection, copy, navigation and application shortcuts.
export function installReadOnlyGuard(editor, source) {
  document.addEventListener('keydown', event => {
    if (editor.isEditable || event.target.closest('dialog, input, select') || (event.target.tagName === 'TEXTAREA' && event.target !== source)) return;
    const inDocument = event.target === source || event.target.closest('.tiptap');
    if (event.ctrlKey || event.metaKey) {
      if (['a','c','f','n','o','s','p','tab',','].includes(event.key.toLowerCase()) || event.shiftKey && event.key.toLowerCase() === 'm') return;
      if (inDocument || ['b','i','e','k','h','z','y','v','x'].includes(event.key.toLowerCase())) {event.preventDefault();event.stopImmediatePropagation();}
    } else if (inDocument && (event.key === 'Tab' || event.key.length === 1 || ['Backspace','Delete','Enter'].includes(event.key))) {
      if (event.key !== 'Tab') event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  for (const type of ['beforeinput','cut','paste','drop']) document.addEventListener(type, event => {
    if (!editor.isEditable && (event.target === source || event.target.closest('.tiptap'))) {event.preventDefault();event.stopImmediatePropagation();}
  }, true);
}
