import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

// Cursor-aware hide: replace tokens with zero-width atomic ranges when cursor NOT on same line.
// Using Decoration.replace() (not mark+display:none) so CM6 correctly maps pointer → doc position.
const hide = Decoration.replace({});
const dim = Decoration.mark({ class: 'cm-md-dim' });

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { state } = view;
  const sel = state.selection.main;
  const activeLine = state.doc.lineAt(sel.head).number;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const lineAtStart = state.doc.lineAt(node.from).number;
        const lineAtEnd = state.doc.lineAt(node.to).number;
        const isActive =
          activeLine >= lineAtStart && activeLine <= lineAtEnd;

        switch (node.name) {
          case 'HeaderMark': {
            // `#` tokens before a heading — hide along with trailing space
            if (!isActive) {
              let end = node.to;
              const nextChar = state.doc.sliceString(node.to, node.to + 1);
              if (nextChar === ' ') end += 1;
              if (end > node.from) builder.add(node.from, end, hide);
            }
            break;
          }
          case 'EmphasisMark':
          case 'CodeMark':
          case 'StrikethroughMark':
          case 'LinkMark':
          case 'URL': {
            if (!isActive && node.to > node.from) builder.add(node.from, node.to, hide);
            break;
          }
          case 'QuoteMark': {
            if (!isActive && node.to > node.from) builder.add(node.from, node.to, dim);
            break;
          }
          // No HR handling here; handled by HR widget extension
        }
      },
    });
  }

  return builder.finish();
}

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet
      ) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    // Skip over hidden ranges when navigating — cursor jumps cleanly between visible chars
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
  }
);

export function noopState(_: EditorState) {
  return null;
}
