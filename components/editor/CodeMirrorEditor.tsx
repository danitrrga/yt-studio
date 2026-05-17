'use client';

import dynamic from 'next/dynamic';
import type { CodeMirrorEditorProps } from './CodeMirrorEditor.client';

const Inner = dynamic(() => import('./CodeMirrorEditor.client'), {
  ssr: false,
  loading: () => (
    <div className="text-sm text-[var(--fg-dim)] py-4">Loading editor…</div>
  ),
});

export function CodeMirrorEditor(props: CodeMirrorEditorProps) {
  return <Inner {...props} />;
}

export type { CodeMirrorEditorProps };
