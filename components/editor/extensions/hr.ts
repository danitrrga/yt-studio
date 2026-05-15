import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';

class HRWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr');
    hr.className = 'cm-md-hr';
    return hr;
  }
  ignoreEvent() {
    return true;
  }
}

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
        if (node.name !== 'HorizontalRule') return;
        const line = state.doc.lineAt(node.from);
        if (line.number === activeLine) return;
        builder.add(
          line.from,
          line.to,
          Decoration.replace({ widget: new HRWidget() })
        );
      },
    });
  }
  return builder.finish();
}

export const hrPlugin = ViewPlugin.fromClass(
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
