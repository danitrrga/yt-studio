'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { useEditorDraft, type DraftStatus } from '@/hooks/use-editor-draft';
import { CodeMirrorEditor } from '@/components/editor/CodeMirrorEditor';
import { EditorErrorBoundary } from '@/components/editor/EditorErrorBoundary';
import { TextareaFallback } from '@/components/editor/TextareaFallback';
import { ConflictBanner } from '@/components/editor/ConflictBanner';
import { cn } from '@/lib/utils';

export type SaveState = DraftStatus;

export function BodyEditor({
  slug,
  initialBody,
  onSaved,
  onStateChange,
  onBodyChange,
  fullHeight = false,
  writingMode = false,
  hideFooter = false,
}: {
  slug: string;
  initialBody: string;
  onSaved?: () => void;
  onStateChange?: (state: SaveState) => void;
  onBodyChange?: (body: string) => void;
  fullHeight?: boolean;
  writingMode?: boolean;
  hideFooter?: boolean;
}) {
  const {
    draft,
    baseline,
    status,
    errorMessage,
    revisionToken,
    initialized,
    pendingExternal,
    setDraft,
    adoptServer,
    keepDraft,
    forceSave,
  } = useEditorDraft(slug);

  // Prevent unused-var warnings for baseline/forceSave/initialBody
  void baseline;
  void forceSave;
  void initialBody;

  useEffect(() => {
    onStateChange?.(status);
  }, [status, onStateChange]);

  useEffect(() => {
    onBodyChange?.(draft);
  }, [draft, onBodyChange]);

  useEffect(() => {
    if (status === 'clean') onSaved?.();
  }, [status, onSaved]);

  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current !== 'error' && status === 'error') {
      toast.error(errorMessage ?? 'Save failed', {
        action: { label: 'Retry', onClick: () => forceSave() },
      });
    }
    prevStatusRef.current = status;
  }, [status, errorMessage, forceSave]);

  // Global Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        forceSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [forceSave]);

  if (!initialized) {
    return (
      <div className="text-sm text-[var(--color-fg-muted)] py-4">Loading...</div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {!fullHeight && (
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
            Script / Notes
          </span>
          <SaveIndicator state={status} />
        </div>
      )}

      {status === 'conflict' && (
        <ConflictBanner
          onReload={adoptServer}
          onKeep={keepDraft}
          conflictHunks={pendingExternal?.conflictHunks}
        />
      )}

      <div>
        <EditorErrorBoundary
          fallback={(err, retry) => (
            <TextareaFallback
              draft={draft}
              onChange={setDraft}
              errorMessage={err.message}
              onRetryMount={retry}
              writingMode={writingMode}
            />
          )}
        >
          <CodeMirrorEditor
            key={slug}
            initialMarkdown={draft}
            revisionToken={revisionToken}
            onMarkdownChange={setDraft}
            writingMode={writingMode}
            autoFocus={fullHeight}
            placeholder="Start writing your script..."
          />
        </EditorErrorBoundary>
      </div>

      {!hideFooter && !fullHeight && !writingMode && (
        <p className="text-xs text-[var(--color-fg-muted)]">
          Markdown shortcuts · Cmd+S force save · $x^2$ math · Obsidian-compatible
        </p>
      )}

      {errorMessage && status === 'error' && (
        <div className="text-xs text-[hsl(var(--color-overdue))]">
          Save failed: {errorMessage}
        </div>
      )}
    </div>
  );
}

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'clean')
    return null;
  if (state === 'dirty')
    return <span className="text-[11px] text-[var(--color-fg-muted)]">Editing...</span>;
  if (state === 'saving')
    return (
      <span className="text-[11px] text-[var(--color-fg-muted)] inline-flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        Saving
      </span>
    );
  if (state === 'conflict')
    return (
      <span className="text-[11px] text-[hsl(var(--status-review))] inline-flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Conflict
      </span>
    );
  if (state === 'error')
    return <span className="text-[11px] text-[hsl(var(--color-overdue))]">Save failed</span>;
  return (
    <span className="text-[11px] text-[hsl(var(--status-published))] inline-flex items-center gap-1">
      <Check className="w-3 h-3" />
      Saved
    </span>
  );
}
