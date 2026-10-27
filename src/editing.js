// A single indentation transaction shared by rich code blocks and source mode.
export function indentation(text, from, to, reverse = false) {
  if (!reverse && from === to) return { from, to, insert: '  ', anchor: from + 2, head: from + 2 };
  const start = from === 0 ? 0 : text.lastIndexOf('\n', from - 1) + 1;
  const end = to > from && text[to - 1] === '\n' ? to - 1 : to;
  const edits = [];
  for (let line = start; line <= end;) {
    const remove = reverse ? (/^(?:\t| {1,2})/.exec(text.slice(line))?.[0].length || 0) : 0;
    if (!reverse || remove) edits.push({ from: line, to: line + remove, insert: reverse ? '' : '  ' });
    const next = text.indexOf('\n', line);
    if (next < 0) break;
    line = next + 1;
  }
  if (!edits.length) return null;
  const last = edits[edits.length - 1];
  const replaceTo = Math.max(to, last.to);
  let insert = text.slice(start, replaceTo);
  for (const edit of [...edits].reverse()) insert = insert.slice(0, edit.from - start) + edit.insert + insert.slice(edit.to - start);
  const map = position => {
    let mapped = position;
    for (const edit of edits) {
      if (position >= edit.to) mapped += edit.insert.length - (edit.to - edit.from);
      else if (position > edit.from) mapped += edit.from + edit.insert.length - position;
    }
    return mapped;
  };
  return { from: start, to: replaceTo, insert, anchor: map(from), head: map(to) };
}

export function indentSource(field, reverse) {
  const edit = indentation(field.value, field.selectionStart, field.selectionEnd, reverse);
  if (!edit) return;
  field.setSelectionRange(edit.from, edit.to);
  // Chromium's native edit command preserves textarea undo history, including
  // in the embedded WebView2. Keep a fallback for engines without this command.
  if (!document.execCommand('insertText', false, edit.insert)) {
    field.setRangeText(edit.insert, edit.from, edit.to);
    field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: edit.insert }));
  }
  field.setSelectionRange(edit.anchor, edit.head);
}
