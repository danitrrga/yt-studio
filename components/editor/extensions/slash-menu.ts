import { CompletionContext, autocompletion, type Completion } from '@codemirror/autocomplete';

const snippets: Array<{ label: string; detail: string; insert: string; move?: number }> = [
  { label: '/h1', detail: 'Heading 1', insert: '# ' },
  { label: '/h2', detail: 'Heading 2', insert: '## ' },
  { label: '/h3', detail: 'Heading 3', insert: '### ' },
  { label: '/todo', detail: 'Task', insert: '- [ ] ' },
  { label: '/list', detail: 'Bullet list', insert: '- ' },
  { label: '/num', detail: 'Numbered list', insert: '1. ' },
  { label: '/quote', detail: 'Blockquote', insert: '> ' },
  { label: '/code', detail: 'Code block', insert: '```\n\n```', move: -4 },
  { label: '/hr', detail: 'Divider', insert: '---\n' },
  { label: '/math', detail: 'Math block', insert: '$$\n\n$$', move: -3 },
  { label: '/table', detail: 'Table', insert: '| col | col |\n| --- | --- |\n| cell | cell |' },
];

function slashCompletions(ctx: CompletionContext) {
  const before = ctx.matchBefore(/\/\w*/);
  if (!before || (before.from === before.to && !ctx.explicit)) return null;

  const options: Completion[] = snippets.map((s) => ({
    label: s.label,
    detail: s.detail,
    type: 'keyword',
    apply: (view, _completion, from, to) => {
      view.dispatch({
        changes: { from, to, insert: s.insert },
        selection: { anchor: from + s.insert.length + (s.move ?? 0) },
      });
    },
  }));

  return {
    from: before.from,
    to: before.to,
    options,
    validFor: /^\/\w*$/,
  };
}

export const slashMenu = autocompletion({
  override: [slashCompletions],
  activateOnTyping: true,
  closeOnBlur: true,
  defaultKeymap: true,
});
