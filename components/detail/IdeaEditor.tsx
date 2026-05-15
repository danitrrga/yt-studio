'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Lightbulb } from 'lucide-react';
import { registerShortcut } from '@/lib/shortcuts';
import { saveVideoMeta } from '@/hooks/use-video-meta';
import type { VideoMeta, VideoMetaSection } from '@/lib/types';
import { cn } from '@/lib/utils';

const FALLBACK_SECTIONS: VideoMetaSection[] = [
  { id: 'idea', heading: 'Idea', body: '' },
  { id: 'production', heading: 'Production', body: '' },
  { id: 'publish', heading: 'Publish', body: '' },
  { id: 'title_ideas', heading: 'Title Ideas', body: '' },
  { id: 'thumbnail_ideas', heading: 'Thumbnail Ideas', body: '' },
  { id: 'post_mortem', heading: 'Post-Mortem', body: '' },
];

function readIdea(meta: VideoMeta | null | undefined): string {
  if (!meta) return '';
  return meta.sections.find((s) => s.id === 'idea')?.body ?? '';
}

export function IdeaEditor({
  slug,
  meta,
  onMutate,
}: {
  slug: string;
  meta: VideoMeta | null | undefined;
  onMutate: () => void;
}) {
  const baseline = useMemo(() => readIdea(meta).trim(), [meta]);
  const [draft, setDraft] = useState(baseline);
  const [busy, setBusy] = useState(false);
  const baselineRef = useRef(baseline);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Adopt server changes when local has no unsaved diff.
  useEffect(() => {
    if (baseline !== baselineRef.current && draft === baselineRef.current) {
      setDraft(baseline);
      baselineRef.current = baseline;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseline]);

  useEffect(() => {
    return registerShortcut({
      id: 'detail.idea.focus',
      keys: ['e'],
      scope: 'detail',
      group: 'Video',
      label: 'Edit idea',
      run: () => taRef.current?.focus(),
    });
  }, []);

  const save = async () => {
    if (draft === baselineRef.current || busy) return;
    setBusy(true);
    try {
      const existing = meta?.sections ?? FALLBACK_SECTIONS;
      const hasIdea = existing.some((s) => s.id === 'idea');
      const merged: VideoMetaSection[] = hasIdea
        ? existing.map((s) => (s.id === 'idea' ? { ...s, body: draft } : s))
        : [{ id: 'idea', heading: 'Idea', body: draft }, ...existing];
      await saveVideoMeta(slug, merged);
      baselineRef.current = draft;
      onMutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Idea save failed');
    } finally {
      setBusy(false);
    }
  };

  const rows = Math.max(2, draft.split('\n').length + 1);

  return (
    <div className="rounded-lg border bg-[var(--color-surface)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 h-10 border-b font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-fg-muted)]">
        <Lightbulb className="w-3 h-3" />
        <span>Idea</span>
        {busy && (
          <span className="ml-auto text-[10px] text-[var(--color-fg-muted)]">Saving…</span>
        )}
      </div>
      <div className="p-4">
        <textarea
          ref={taRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          rows={rows}
          placeholder="One or two sentences that capture the core message."
          className={cn(
            'w-full bg-transparent outline-none text-[15px] leading-relaxed resize-none',
            'text-[var(--color-fg)] placeholder:text-[var(--color-fg-muted)]'
          )}
        />
      </div>
    </div>
  );
}
