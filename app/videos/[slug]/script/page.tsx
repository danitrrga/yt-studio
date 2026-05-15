'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Maximize2 } from 'lucide-react';
import { useVideo, updateVideoField } from '@/hooks/use-videos';
import { useUI } from '@/components/UIProvider';
import { recordVisit } from '@/hooks/use-mru';
import { PropStrip } from '@/components/detail/PropStrip';
import { BodyEditor, type SaveState } from '@/components/detail/BodyEditor';
import { WordCount } from '@/components/detail/WordCount';
import { cn } from '@/lib/utils';

export default function VideoScriptPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { video, mutate } = useVideo(slug);
  const { writingMode, toggleWritingMode, setWritingMode } = useUI();
  const [saveState, setSaveState] = useState<SaveState>('clean');
  const [localTitle, setLocalTitle] = useState('');
  const [liveBody, setLiveBody] = useState('');

  useEffect(() => {
    if (video) {
      setLocalTitle(video.frontmatter.title);
      setLiveBody(video.body);
    }
  }, [video]);

  useEffect(() => {
    if (video) {
      document.title = `${video.frontmatter.title || video.slug} · Script`;
      recordVisit(slug, 'video', video.frontmatter.title || video.slug);
    }
    return () => {
      document.title = 'YouTube Studio';
    };
  }, [video, slug]);

  useEffect(() => {
    return () => setWritingMode(false);
  }, [setWritingMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (writingMode) return; // writing mode handles own exit
        router.push(`/videos/${slug}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [writingMode, router, slug]);

  if (!video) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-[var(--color-fg-muted)]">
        Loading...
      </div>
    );
  }

  const handleTitleBlur = async () => {
    if (localTitle === video.frontmatter.title) return;
    await updateVideoField(video.slug, { title: localTitle });
    mutate();
  };

  return (
    <div
      className={cn(
        'h-screen flex flex-col',
        writingMode ? 'bg-[var(--bg-sunken)]' : 'bg-[var(--bg)]'
      )}
    >
      {!writingMode && (
        <div className="h-10 shrink-0 border-b flex items-center justify-between px-5 text-[12px] bg-[var(--color-surface)]">
          <Link
            href={`/videos/${slug}`}
            className="inline-flex items-center gap-1.5 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Dashboard
          </Link>
          <span className="text-[var(--color-fg-secondary)] truncate mx-4">
            {video.frontmatter.title || video.slug}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[var(--color-fg-muted)] tabular-nums">
              {saveState === 'clean' && 'Saved'}
              {saveState === 'dirty' && 'Editing…'}
              {saveState === 'saving' && 'Saving…'}
              {saveState === 'conflict' && 'Conflict'}
              {saveState === 'error' && 'Error'}
            </span>
            <button
              onClick={toggleWritingMode}
              className="inline-flex items-center gap-1.5 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              title="Focus (W)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Focus
            </button>
          </div>
        </div>
      )}

      {writingMode && <MinimalWritingBar saveState={saveState} />}

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div
          className={cn(
            'mx-auto flex flex-col px-6',
            writingMode ? 'max-w-[720px] py-20 gap-4' : 'max-w-[760px] py-10 gap-3'
          )}
        >
          {!writingMode && (
            <>
              <input
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                placeholder="Untitled video"
                className="w-full bg-transparent outline-none font-semibold tracking-[-0.012em] text-[28px] leading-[1.2] focus:bg-[var(--color-surface-hover)] rounded px-1 -mx-1 py-1"
              />
              <PropStrip video={video} onMutate={mutate} />
            </>
          )}

          <div className={cn(!writingMode && 'pt-4')}>
            <BodyEditor
              slug={video.slug}
              initialBody={video.body}
              onSaved={mutate}
              onStateChange={setSaveState}
              onBodyChange={setLiveBody}
              fullHeight
              writingMode={writingMode}
              hideFooter
            />
          </div>
        </div>
      </div>

      {!writingMode && (
        <footer className="h-10 shrink-0 border-t flex items-center justify-between px-6 text-xs text-[var(--color-fg-muted)] bg-[var(--color-surface)]">
          <WordCount body={liveBody} />
          <div className="flex items-center gap-3">
            <kbd className="px-1.5 py-0.5 rounded border bg-[var(--color-surface-elevated)] text-[10px]">W</kbd>
            <span>Focus</span>
            <span className="text-[var(--color-border)]">·</span>
            <kbd className="px-1.5 py-0.5 rounded border bg-[var(--color-surface-elevated)] text-[10px]">Esc</kbd>
            <span>Dashboard</span>
          </div>
        </footer>
      )}

      {writingMode && <WritingModeFooter body={liveBody} saveState={saveState} />}
    </div>
  );
}

function MinimalWritingBar({ saveState }: { saveState: SaveState }) {
  const { toggleWritingMode } = useUI();
  return (
    <div className="h-10 shrink-0 flex items-center justify-between px-4 text-xs">
      <span className="text-[var(--color-fg-muted)]">Focus mode</span>
      <div className="flex items-center gap-3 text-[var(--color-fg-muted)]">
        <span>
          {saveState === 'dirty' && 'Editing...'}
          {saveState === 'saving' && 'Saving...'}
          {saveState === 'clean' && 'Saved'}
          {saveState === 'conflict' && 'Conflict'}
          {saveState === 'error' && 'Error'}
        </span>
        <button
          onClick={toggleWritingMode}
          className="hover:text-[var(--color-fg)]"
        >
          Exit focus (Esc)
        </button>
      </div>
    </div>
  );
}

function WritingModeFooter({ body, saveState }: { body: string; saveState: SaveState }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-[var(--color-surface-elevated)] border rounded-full px-4 py-1.5 text-xs text-[var(--color-fg-muted)]"
    >
      <WordCount body={body} />
      <span className="text-[var(--color-border)]">·</span>
      <span className={saveState === 'clean' ? 'text-[hsl(var(--status-published))]' : ''}>
        {saveState === 'dirty' && '...'}
        {saveState === 'saving' && 'Saving'}
        {saveState === 'clean' && 'Saved'}
        {saveState === 'conflict' && 'Conflict'}
        {saveState === 'error' && 'Error'}
      </span>
    </motion.div>
  );
}
