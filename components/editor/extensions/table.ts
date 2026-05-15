import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder, StateField, type EditorState } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view';

type Align = 'left' | 'center' | 'right' | null;

class TableWidget extends WidgetType {
  constructor(private source: string) {
    super();
  }

  eq(other: TableWidget) {
    return other.source === this.source;
  }

  toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'cm-md-table-wrap';
    const table = document.createElement('table');
    table.className = 'cm-md-table';

    const lines = this.source.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      wrap.textContent = this.source;
      return wrap;
    }

    const headerCells = splitRow(lines[0]);
    const aligns = parseDelimiters(lines[1]);
    const bodyRows = lines.slice(2).map(splitRow);

    const thead = document.createElement('thead');
    const headerTr = document.createElement('tr');
    headerCells.forEach((text, i) => {
      const th = document.createElement('th');
      th.textContent = text;
      const a = aligns[i];
      if (a) th.style.textAlign = a;
      headerTr.appendChild(th);
    });
    thead.appendChild(headerTr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const cells of bodyRows) {
      const tr = document.createElement('tr');
      cells.forEach((text, i) => {
        const td = document.createElement('td');
        renderInline(td, text);
        const a = aligns[i];
        if (a) td.style.textAlign = a;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  ignoreEvent() {
    return false;
  }
}

function splitRow(line: string): string[] {
  const trimmed = line.replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function parseDelimiters(line: string): Align[] {
  return splitRow(line).map((seg) => {
    const s = seg.trim();
    const left = s.startsWith(':');
    const right = s.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return null;
  });
}

function renderInline(el: HTMLElement, text: string) {
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const code = /^`([^`]+)`/.exec(rest);
    if (code) {
      const c = document.createElement('code');
      c.textContent = code[1];
      el.appendChild(c);
      i += code[0].length;
      continue;
    }
    const strong = /^\*\*([^*]+)\*\*/.exec(rest);
    if (strong) {
      const b = document.createElement('strong');
      b.textContent = strong[1];
      el.appendChild(b);
      i += strong[0].length;
      continue;
    }
    const em = /^\*([^*]+)\*/.exec(rest);
    if (em) {
      const e = document.createElement('em');
      e.textContent = em[1];
      el.appendChild(e);
      i += em[0].length;
      continue;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)/.exec(rest);
    if (link) {
      const a = document.createElement('a');
      a.textContent = link[1];
      a.href = link[2];
      a.target = '_blank';
      a.rel = 'noreferrer';
      el.appendChild(a);
      i += link[0].length;
      continue;
    }
    el.appendChild(document.createTextNode(rest[0]));
    i += 1;
  }
}

function build(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const sel = state.selection.main;
  const activeLine = state.doc.lineAt(sel.head).number;

  syntaxTree(state).iterate({
    from: 0,
    to: state.doc.length,
    enter: (node) => {
      if (node.name !== 'Table') return;
      const startLine = state.doc.lineAt(node.from);
      const endLine = state.doc.lineAt(Math.min(node.to, state.doc.length));
      const cursorInside =
        activeLine >= startLine.number && activeLine <= endLine.number;
      if (cursorInside) return false;
      const source = state.doc.sliceString(startLine.from, endLine.to);
      builder.add(
        startLine.from,
        endLine.to,
        Decoration.replace({ widget: new TableWidget(source), block: true })
      );
      return false;
    },
  });
  return builder.finish();
}

export const tablePlugin = StateField.define<DecorationSet>({
  create: (state) => build(state),
  update: (value, tr) => {
    if (tr.docChanged || tr.selection) return build(tr.state);
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});
