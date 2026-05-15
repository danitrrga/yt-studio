import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly pos: number) {
    super();
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.pos === this.pos;
  }
  toDOM(view: EditorView) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.checked;
    input.className = 'cm-md-task-checkbox';
    input.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const nextChar = this.checked ? ' ' : 'x';
      // Replace single char between brackets
      // Widget is placed AT the `[` position; char to replace is at pos+1
      view.dispatch({
        changes: { from: this.pos + 1, to: this.pos + 2, insert: nextChar },
      });
    });
    return input;
  }
  ignoreEvent(e: Event) {
    // Let click propagate to the checkbox handler, block others
    return e.type !== 'mousedown';
  }
}

// Task lines in lezer-markdown GFM look like: `- [ ] todo` — the TaskMarker node spans `[ ]` or `[x]`
function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { state } = view;
  const sel = state.selection.main;
  const activeLine = state.doc.lineAt(sel.head).number;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== 'TaskMarker') return;
        const text = state.doc.sliceString(node.from, node.to); // "[ ]" or "[x]"
        if (text.length !== 3) return;
        const checked = text[1].toLowerCase() === 'x';
        const line = state.doc.lineAt(node.from);
        if (line.number === activeLine) return;
        // Replace "[ ]" with checkbox widget
        builder.add(
          node.from,
          node.to,
          Decoration.replace({ widget: new CheckboxWidget(checked, node.from) })
        );
      },
    });
  }
  return builder.finish();
}

export const taskCheckboxPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || u.selectionSet)
        this.decorations = build(u.view);
    }
  },
  { decorations: (v) => v.decorations }
);
