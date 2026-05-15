'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { toast } from 'sonner';
import { ArrowLeft, ExternalLink, Check, Loader2 } from 'lucide-react';
import { CodeMirrorEditor } from '@/components/editor/CodeMirrorEditor';
import { EditorErrorBoundary } from '@/components/editor/EditorErrorBoundary';
import { TextareaFallback } from '@/components/editor/TextareaFallback';
import type { HubPage } from '@/lib/types';
import { recordVisit } from '@/hooks/use-mru';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SaveState = 'clean' | 'dirty' | 'saving' | 'error';

export default function HubDocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { data, isLoading, mutate } = useSWR<HubPage>(
    `/api/hub/pages/${slug}`,
    fetcher
  );

  const [draft, setDraft] = useState<string>('');
  const [baseline, setBaseline] = useState<string>('');
  const [save, setSave] = useState<SaveState>('clean');
  const [revisionToken, setRevisionToken] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from server
  useEffect(() => {
    if (!data) return;
    setDraft(data.content);
    setBaseline(data.content);
    setRevisionToken((t) => t + 1);
    setSave('clean');
    recordVisit(slug, 'doc', data.title || slug);
  }, [data?.slug, slug]);

  const persist = useCallback(
    async (value: string) => {
      setSave('saving');
      try {
        const res = await fetch(`/api/hub/pages/${slug}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: value }),
        });
        if (!res.ok) throw new Error('Save failed');
        setBaseline(value);
        setSave((s) => (s === 'saving' ? 'clean' : s));
        mutate();
      } catch (e) {
        setSave('error');
        toast.error(e instanceof Error ? e.message : 'Save failed');
      }
    },
    [slug, mutate]
  );

  const onChange = useCallback(
    (value: string) => {
      setDraft(value);
      if (value === baseline) {
        setSave('clean');
        if (timer.current) clearTimeout(timer.current);
        return;
      }
      setSave('dirty');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => persist(value), 800);
    },
    [baseline, persist]
  );

  // Cmd+S — flush immediately
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        if (draft !== baseline) persist(draft);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [draft, baseline, persist]);

  const title = useMemo(() => data?.title ?? slug, [data, slug]);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="sticky top-0 z-20 h-12 px-5 flex items-center justify-between gap-3 border-b bg-[var(--color-bg)]">
        <Link
          href="/hub"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-secondary)] hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="w-4 h-4" />
          Hub
        </Link>
        <div className="flex-1 text-sm font-semibold truncate text-center">
          {title}
        </div>
        <div className="flex items-center gap-3">
          <SaveBadge state={save} />
          {data && (
            <a
              href={data.obsidianUri}
              title="Open in Obsidian"
              className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      <div className="flex-1 px-8 py-8">
        <div className="max-w-[760px] mx-auto">
          {isLoading ? (
            <div className="text-sm text-[var(--color-fg-muted)]">Loading…</div>
          ) : (
            <EditorErrorBoundary
              fallback={(err, retry) => (
                <TextareaFallback
                  draft={draft}
                  onChange={onChange}
                  errorMessage={err.message}
                  onRetryMount={retry}
                  writingMode={false}
                />
              )}
            >
              <CodeMirrorEditor
                key={slug}
                initialMarkdown={draft}
                revisionToken={revisionToken}
                onMarkdownChange={onChange}
                placeholder="Empty — start writing…"
                writingMode={false}
                autoFocus={false}
              />
            </EditorErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === 'clean')
    return (
      <span className="text-[11px] text-[hsl(var(--status-published))] inline-flex items-center gap-1">
        <Check className="w-3 h-3" />
        Saved
      </span>
    );
  if (state === 'dirty')
    return <span className="text-[11px] text-[var(--color-fg-muted)]">Editing…</span>;
  if (state === 'saving')
    return (
      <span className="text-[11px] text-[var(--color-fg-muted)] inline-flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        Saving
      </span>
    );
  return <span className="text-[11px] text-[hsl(var(--color-overdue))]">Save failed</span>;
}
