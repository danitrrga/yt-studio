import { keymap } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';

function continueList(view: EditorView): boolean {
  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const line = state.doc.lineAt(sel.head);
  const text = line.text;

  // Match bullet/task/ordered list markers
  const taskMatch = /^(\s*)([-*+])\s+\[([ xX])\]\s*(.*)$/.exec(text);
  const bulletMatch = /^(\s*)([-*+])\s+(.*)$/.exec(text);
  const orderedMatch = /^(\s*)(\d+)\.\s+(.*)$/.exec(text);

  if (taskMatch) {
    const [, indent, marker, , rest] = taskMatch;
    if (rest.trim() === '') {
      // Empty task — exit list
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: '' },
        selection: { anchor: line.from },
      });
      return true;
    }
    const insert = `\n${indent}${marker} [ ] `;
    view.dispatch({
      changes: { from: sel.head, to: sel.head, insert },
      selection: { anchor: sel.head + insert.length },
    });
    return true;
  }

  if (bulletMatch) {
    const [, indent, marker, rest] = bulletMatch;
    if (rest.trim() === '') {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: '' },
        selection: { anchor: line.from },
      });
      return true;
    }
    const insert = `\n${indent}${marker} `;
    view.dispatch({
      changes: { from: sel.head, to: sel.head, insert },
      selection: { anchor: sel.head + insert.length },
    });
    return true;
  }

  if (orderedMatch) {
    const [, indent, numStr, rest] = orderedMatch;
    if (rest.trim() === '') {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: '' },
        selection: { anchor: line.from },
      });
      return true;
    }
    const next = Number(numStr) + 1;
    const insert = `\n${indent}${next}. `;
    view.dispatch({
      changes: { from: sel.head, to: sel.head, insert },
      selection: { anchor: sel.head + insert.length },
    });
    return true;
  }

  return false;
}

export const markdownKeymap = keymap.of([
  { key: 'Enter', run: continueList },
]);
