import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const INTER = `"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif`;
const MONO = `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;

const FG = '#fafafa';
const FG_SEC = '#bbbbc0';
const FG_MUTED = '#8a8a91';
const BG = '#09090f';
const BG_WRITING = '#0f0e0d';
const SURFACE = '#101013';
const SURFACE_ELEV = '#17171c';
const BORDER = '#272729';
const ACCENT = '#1ae6e6';

export const studioTheme = EditorView.theme(
  {
    '&': {
      fontFamily: INTER,
      fontSize: '16px',
      color: FG,
      backgroundColor: 'transparent',
      height: '100%',
      border: 'none',
      outline: 'none',
    },
    '.cm-scroller': {
      fontFamily: INTER,
      lineHeight: '1.7',
      overflow: 'visible',
    },
    '.cm-content': {
      caretColor: FG,
      padding: '0',
    },
    '.cm-line': {
      padding: '0 0',
    },
    '&.cm-focused .cm-cursor, &.cm-focused .cm-cursor-primary': {
      borderLeftColor: FG,
      borderLeftWidth: '1.5px',
    },
    '.cm-selectionBackground': {
      backgroundColor: 'rgba(255,255,255,0.09) !important',
      borderRadius: '2px',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: 'rgba(255,255,255,0.13) !important',
    },
    '::selection': {
      backgroundColor: 'rgba(255,255,255,0.13)',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '&.cm-focused .cm-activeLine': {
      backgroundColor: 'rgba(255,255,255,0.02)',
    },
    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: 'rgba(255,255,255,0.08)',
      color: 'inherit',
      outline: 'none',
    },
    '.cm-selectionMatch': {
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    '.cm-gutters': { display: 'none' },

    // Writing mode
    '&.cm-writing-mode .cm-content': {
      fontSize: '17px',
      lineHeight: '1.75',
      letterSpacing: '0.005em',
    },

    // Inline code
    '.cm-md-inline-code': {
      fontFamily: MONO,
      fontSize: '0.88em',
      background: SURFACE_ELEV,
      padding: '0.1em 0.3em',
      borderRadius: '4px',
      border: `1px solid ${BORDER}`,
    },

    // Code blocks
    '.cm-md-code-block': {
      fontFamily: MONO,
      background: SURFACE_ELEV,
      padding: '0.75em 1em',
      borderRadius: '8px',
      border: `1px solid ${BORDER}`,
      fontSize: '13px',
      lineHeight: '1.5',
    },

    // Heading sizes — Notion-feel
    '.cm-md-h1': { fontSize: '32px', fontWeight: '700', letterSpacing: '-0.02em', lineHeight: '1.25', marginTop: '0.6em' },
    '.cm-md-h2': { fontSize: '24px', fontWeight: '700', letterSpacing: '-0.015em', lineHeight: '1.3', marginTop: '0.8em' },
    '.cm-md-h3': { fontSize: '20px', fontWeight: '600', lineHeight: '1.35', marginTop: '0.6em' },
    '.cm-md-h4': { fontSize: '17px', fontWeight: '600' },
    '.cm-md-h5': { fontSize: '15px', fontWeight: '600' },
    '.cm-md-h6': { fontSize: '14px', fontWeight: '600' },

    // Link
    '.cm-md-link': { color: ACCENT, textDecoration: 'underline', textUnderlineOffset: '2px' },

    // Blockquote
    '.cm-md-blockquote': {
      borderLeft: `3px solid ${BORDER}`,
      paddingLeft: '1em',
      color: FG_SEC,
      fontStyle: 'italic',
    },

    // HR
    '.cm-md-hr': {
      display: 'block',
      borderTop: `1px solid ${BORDER}`,
      margin: '1em 0',
      height: '1px',
    },

    // Table (GFM)
    '.cm-md-table-wrap': {
      margin: '0.5em 0',
      overflow: 'auto',
      borderRadius: '6px',
      border: `1px solid ${BORDER}`,
    },
    '.cm-md-table': {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '14px',
      fontFamily: INTER,
    },
    '.cm-md-table th, .cm-md-table td': {
      padding: '0.5em 0.75em',
      borderBottom: `1px solid ${BORDER}`,
      textAlign: 'left',
      verticalAlign: 'top',
    },
    '.cm-md-table th': {
      fontWeight: '600',
      color: FG_SEC,
      fontSize: '12px',
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
      background: SURFACE,
    },
    '.cm-md-table tbody tr:last-child td': {
      borderBottom: 'none',
    },
    '.cm-md-table tbody tr:hover': {
      background: 'rgba(255,255,255,0.02)',
    },
    '.cm-md-table code': {
      fontFamily: MONO,
      fontSize: '0.85em',
      background: SURFACE_ELEV,
      padding: '0.1em 0.3em',
      borderRadius: '4px',
      border: `1px solid ${BORDER}`,
    },
    '.cm-md-table a': {
      color: ACCENT,
      textDecoration: 'underline',
      textUnderlineOffset: '2px',
    },

    // Task checkbox widget
    '.cm-md-task-checkbox': {
      cursor: 'pointer',
      marginRight: '0.4em',
      accentColor: ACCENT,
      verticalAlign: 'middle',
    },

    // Hidden syntax token (used when cursor off line)
    '.cm-md-hidden': {
      display: 'none',
    },

    '.cm-md-dim': {
      color: FG_MUTED,
    },

    // Focus-line: dim non-active paragraphs in writing mode
    '&.cm-editor.cm-focused .cm-focus-dim, .cm-focus-dim': {
      opacity: '0.32',
      transition: 'opacity 220ms ease',
    },

    // Placeholder
    '.cm-placeholder': {
      color: FG_MUTED,
      fontStyle: 'normal',
    },
  },
  { dark: true }
);

export const writingModeTheme = EditorView.theme({
  '.cm-content': {
    fontSize: '17px',
    lineHeight: '1.75',
    letterSpacing: '0.005em',
  },
  '.cm-md-h1': { fontSize: '34px' },
  '.cm-md-h2': { fontSize: '26px' },
  '.cm-md-h3': { fontSize: '20px' },
});

export const studioHighlight = HighlightStyle.define([
  { tag: t.heading1, class: 'cm-md-h1' },
  { tag: t.heading2, class: 'cm-md-h2' },
  { tag: t.heading3, class: 'cm-md-h3' },
  { tag: t.heading4, class: 'cm-md-h4' },
  { tag: t.heading5, class: 'cm-md-h5' },
  { tag: t.heading6, class: 'cm-md-h6' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, class: 'cm-md-link' },
  { tag: t.url, class: 'cm-md-dim' },
  { tag: t.monospace, class: 'cm-md-inline-code' },
  { tag: t.quote, class: 'cm-md-blockquote' },
  { tag: t.meta, color: FG_MUTED },
  { tag: t.comment, color: FG_MUTED, fontStyle: 'italic' },
]);

export const studioSyntaxHighlighting = syntaxHighlighting(studioHighlight);
