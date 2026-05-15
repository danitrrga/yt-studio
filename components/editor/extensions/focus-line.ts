import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

// Writing-mode focus-line: dim all paragraphs except the one containing the cursor.
// A paragraph = contiguous non-empty lines separated by blank lines.

const dimMark = Decoration.line({ class: 'cm-focus-dim' });

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { state } = view;
  if (!view.dom.classList.contains('writing-mode')) return builder.finish();

  const cursorLine = state.doc.lineAt(state.selection.main.head).number;

  // Compute paragraph span containing the cursor
  const total = state.doc.lines;
  let activeStart = cursorLine;
  let activeEnd = cursorLine;
  // Walk up
  for (let ln = cursorLine - 1; ln >= 1; ln--) {
    if (state.doc.line(ln).text.trim() === '') break;
    activeStart = ln;
  }
  // Walk down
  for (let ln = cursorLine + 1; ln <= total; ln++) {
    if (state.doc.line(ln).text.trim() === '') break;
    activeEnd = ln;
  }

  for (const { from, to } of view.visibleRanges) {
    const startLine = state.doc.lineAt(from).number;
    const endLine = state.doc.lineAt(to).number;
    for (let ln = startLine; ln <= endLine; ln++) {
      if (ln >= activeStart && ln <= activeEnd) continue;
      const line = state.doc.line(ln);
      if (line.text.trim() === '') continue;
      builder.add(line.from, line.from, dimMark);
    }
  }
  return builder.finish();
}

export const focusLinePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || u.selectionSet) {
        this.decorations = build(u.view);
      } else {
        // Writing-mode class may toggle without a CM update — rebuild on any update
        this.decorations = build(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
