'use client';

import { useEffect, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, highlightActiveLine, placeholder as cmPlaceholder, drawSelection, highlightSpecialChars } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { bracketMatching, indentOnInput, indentUnit } from '@codemirror/language';
import { useSettings } from '@/hooks/use-settings';
import { indentString } from '@/lib/settings';
import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { studioTheme, writingModeTheme, studioSyntaxHighlighting } from './theme';
import { livePreviewPlugin } from './extensions/live-preview';
import { hrPlugin } from './extensions/hr';
import { tablePlugin } from './extensions/table';
import { taskCheckboxPlugin } from './extensions/task-checkbox';
import { mathPlugin } from './extensions/math';
import { focusLinePlugin } from './extensions/focus-line';
import { slashMenu } from './extensions/slash-menu';
import { markdownKeymap } from './extensions/markdown-keymap';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';

export interface CodeMirrorEditorProps {
  initialMarkdown: string;
  revisionToken: number;
  onMarkdownChange: (md: string) => void;
  writingMode?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function CodeMirrorEditor({
  initialMarkdown,
  revisionToken,
  onMarkdownChange,
  writingMode = false,
  placeholder = 'Start writing...',
  autoFocus = false,
}: CodeMirrorEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const writingCompartment = useRef(new Compartment());
  const indentCompartment = useRef(new Compartment());
  const loadingRef = useRef(false);
  const onChangeRef = useRef(onMarkdownChange);
  onChangeRef.current = onMarkdownChange;
  const { settings } = useSettings();

  // Mount
  useEffect(() => {
    if (!hostRef.current) return;

    const state = EditorState.create({
      doc: initialMarkdown,
      extensions: [
        history(),
        drawSelection(),
        highlightSpecialChars(),
        highlightSelectionMatches(),
        highlightActiveLine(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        markdown({ base: markdownLanguage, codeLanguages: [], extensions: [GFM] }),
        studioSyntaxHighlighting,
        livePreviewPlugin,
        hrPlugin,
        tablePlugin,
        taskCheckboxPlugin,
        mathPlugin,
        focusLinePlugin,
        slashMenu,
        markdownKeymap,
        studioTheme,
        writingCompartment.current.of(writingMode ? writingModeTheme : []),
        indentCompartment.current.of(indentUnit.of(indentString(settings.tabWidth))),
        EditorView.lineWrapping,
        cmPlaceholder(placeholder),
        keymap.of([
          // Tab → indent (inserts spaces); Shift-Tab → outdent.
          // Listed first so it captures Tab before browser's default focus shift.
          indentWithTab,
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...completionKeymap,
        ]),
        EditorView.updateListener.of((u) => {
          if (!u.docChanged) return;
          if (loadingRef.current) return;
          const md = u.state.doc.toString();
          onChangeRef.current(md);
        }),
      ],
    });

    const v = new EditorView({
      state,
      parent: hostRef.current,
    });
    viewRef.current = v;

    if (writingMode) v.dom.classList.add('cm-writing-mode');
    if (autoFocus) setTimeout(() => v.focus(), 0);

    return () => {
      v.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External content update (init + adopt) — preserve selection when possible
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current === initialMarkdown) return;
    const prevAnchor = v.state.selection.main.anchor;
    const prevHead = v.state.selection.main.head;
    loadingRef.current = true;
    const anchor = Math.min(prevAnchor, initialMarkdown.length);
    const head = Math.min(prevHead, initialMarkdown.length);
    v.dispatch({
      changes: { from: 0, to: current.length, insert: initialMarkdown },
      selection: { anchor, head },
    });
    loadingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revisionToken]);

  // Writing mode toggle
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    v.dispatch({
      effects: writingCompartment.current.reconfigure(writingMode ? writingModeTheme : []),
    });
    v.dom.classList.toggle('cm-writing-mode', writingMode);
  }, [writingMode]);

  // Tab width — reconfigure indent unit when settings change
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    v.dispatch({
      effects: indentCompartment.current.reconfigure(
        indentUnit.of(indentString(settings.tabWidth))
      ),
    });
  }, [settings.tabWidth]);

  return (
    <div
      ref={hostRef}
      className={cn('cm-editor-root', writingMode && 'cm-writing-mode-root')}
      style={{ fontSize: `${settings.bodyFontSize}px` }}
    />
  );
}
