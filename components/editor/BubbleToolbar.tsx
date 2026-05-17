'use client';

import { useEffect, useState } from 'react';
import type { EditorView } from '@codemirror/view';
import { Bold, Italic, Strikethrough, Code, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Pos {
  top: number;
  left: number;
  visible: boolean;
}

function wrapSelection(view: EditorView, left: string, right: string = left) {
  const { state } = view;
  const sel = state.selection.main;
  if (sel.empty) return;
  const text = state.doc.sliceString(sel.from, sel.to);
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: `${left}${text}${right}` },
    selection: { anchor: sel.from + left.length, head: sel.from + left.length + text.length },
  });
  view.focus();
}

function insertLink(view: EditorView) {
  const url = window.prompt('URL:');
  if (!url) return;
  const { state } = view;
  const sel = state.selection.main;
  const label = sel.empty ? 'link' : state.doc.sliceString(sel.from, sel.to);
  const insert = `[${label}](${url})`;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert },
    selection: { anchor: sel.from + 1, head: sel.from + 1 + label.length },
  });
  view.focus();
}

export function BubbleToolbar({ view }: { view: EditorView | null }) {
  const [pos, setPos] = useState<Pos>({ top: 0, left: 0, visible: false });

  useEffect(() => {
    if (!view) return;
    const update = () => {
      const sel = view.state.selection.main;
      if (sel.empty) {
        setPos((p) => (p.visible ? { ...p, visible: false } : p));
        return;
      }
      const coords = view.coordsAtPos(sel.from);
      if (!coords) {
        setPos((p) => (p.visible ? { ...p, visible: false } : p));
        return;
      }
      setPos({
        top: coords.top - 42,
        left: Math.max(8, coords.left),
        visible: true,
      });
    };
    // Subscribe via updateListener registered once
    const listener = () => update();
    const dom = view.dom;
    dom.addEventListener('mouseup', listener);
    dom.addEventListener('keyup', listener);
    return () => {
      dom.removeEventListener('mouseup', listener);
      dom.removeEventListener('keyup', listener);
    };
  }, [view]);

  if (!view || !pos.visible) return null;

  return (
    <div
      className="fixed z-50 flex items-center gap-0.5 rounded-md border bg-[var(--bg-raised)] p-0.5"
      style={{ top: pos.top, left: pos.left }}
    >
      <Btn onClick={() => wrapSelection(view, '**')} Icon={Bold} />
      <Btn onClick={() => wrapSelection(view, '*')} Icon={Italic} />
      <Btn onClick={() => wrapSelection(view, '~~')} Icon={Strikethrough} />
      <Btn onClick={() => wrapSelection(view, '`')} Icon={Code} />
      <Btn onClick={() => insertLink(view)} Icon={LinkIcon} />
    </div>
  );
}

function Btn({ onClick, Icon }: { onClick: () => void; Icon: React.ElementType }) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        'p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--fg-muted)]'
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
