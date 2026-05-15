import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import katex from 'katex';

class MathWidget extends WidgetType {
  constructor(readonly latex: string, readonly block: boolean) {
    super();
  }
  eq(o: MathWidget) {
    return o.latex === this.latex && o.block === this.block;
  }
  toDOM() {
    const el = document.createElement(this.block ? 'div' : 'span');
    el.className = this.block ? 'cm-md-math-block' : 'cm-md-math-inline';
    try {
      katex.render(this.latex, el, {
        throwOnError: false,
        displayMode: this.block,
      });
    } catch {
      el.textContent = (this.block ? '$$' : '$') + this.latex + (this.block ? '$$' : '$');
    }
    return el;
  }
  ignoreEvent() {
    return true;
  }
}

// Regex scan — block $$...$$ on own lines, inline $...$ within line
function buildMath(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { state } = view;
  const sel = state.selection.main;
  const activeLine = state.doc.lineAt(sel.head).number;
  const text = state.doc.toString();

  // Block math: $$\n...\n$$
  const blockRe = /\$\$\n([\s\S]+?)\n\$\$/g;
  const blockRanges: Array<[number, number]> = [];
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(text))) {
    blockRanges.push([m.index, m.index + m[0].length]);
  }

  // Sort builder additions strictly by position
  const marks: Array<{ from: number; to: number; deco: Decoration }> = [];

  for (const [from, to] of blockRanges) {
    const startLine = state.doc.lineAt(from).number;
    const endLine = state.doc.lineAt(to).number;
    if (activeLine >= startLine && activeLine <= endLine) continue;
    const latex = text.slice(from + 3, to - 3); // strip $$\n and \n$$
    marks.push({
      from,
      to,
      deco: Decoration.replace({ widget: new MathWidget(latex, true), block: true }),
    });
  }

  // Inline math: $...$ (not preceded by $, not crossing newlines)
  // Run per line
  for (let ln = 1; ln <= state.doc.lines; ln++) {
    const line = state.doc.line(ln);
    if (ln === activeLine) continue;
    // Skip lines inside block math ranges
    const inBlock = blockRanges.some(([a, b]) => line.from >= a && line.to <= b);
    if (inBlock) continue;
    const inlineRe = /(?<!\$)\$([^\n$]+?)\$(?!\$)/g;
    const body = line.text;
    let mm: RegExpExecArray | null;
    while ((mm = inlineRe.exec(body))) {
      const from = line.from + mm.index;
      const to = from + mm[0].length;
      const latex = mm[1];
      marks.push({
        from,
        to,
        deco: Decoration.replace({ widget: new MathWidget(latex, false) }),
      });
    }
  }

  marks.sort((a, b) => a.from - b.from || a.to - b.to);
  for (const m of marks) builder.add(m.from, m.to, m.deco);
  return builder.finish();
}

export const mathPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildMath(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || u.selectionSet)
        this.decorations = buildMath(u.view);
    }
  },
  { decorations: (v) => v.decorations }
);
