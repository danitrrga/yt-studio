'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, ChevronUp, ChevronDown, ExternalLink, PanelRight, Feather, Maximize2, Minimize2, Trash2 } from 'lucide-react';
import { useUI } from '@/components/UIProvider';
import { Tooltip } from '@/components/ui/Tooltip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SaveIndicator, type SaveState } from './BodyEditor';
import type { Video } from '@/lib/types';
import { deleteVideoRequest, restoreVideoRequest, useVideos } from '@/hooks/use-videos';
import { cn } from '@/lib/utils';

export function FullPageHeader({
  video,
  prevSlug,
  nextSlug,
  saveState,
  index,
  total,
}: {
  video: Video;
  prevSlug: string | null;
  nextSlug: string | null;
  saveState: SaveState;
  index: number;
  total: number;
}) {
  const router = useRouter();
  const { metadataCollapsed, toggleMetadata, toggleWritingMode, writingMode, fullscreen, toggleFullscreen } = useUI();
  const { mutate: mutateList } = useVideos();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = async () => {
    const title = video.frontmatter.title || video.slug;
    try {
      const res = await deleteVideoRequest(video.slug);
      router.push('/videos');
      mutateList();
      toast.success(`Deleted "${title}"`, {
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await restoreVideoRequest(res.slug, res.trashedAt);
              mutateList();
              toast.success(`Restored "${title}"`);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Restore failed');
            }
          },
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <header className="h-14 shrink-0 border-b flex items-center justify-between px-4 bg-[var(--color-surface)]">
      <div className="flex items-center gap-2 min-w-0">
        <Tooltip content="Back to list (Esc)">
          <Link
            href="/videos"
            className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-fg-secondary)] shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Tooltip>
        <nav className="flex items-center gap-1.5 text-sm min-w-0">
          <Link
            href="/videos"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] shrink-0"
          >
            All videos
          </Link>
          <span className="text-[var(--color-fg-muted)]">/</span>
          <span className="text-[var(--color-fg)] truncate font-medium">
            {video.frontmatter.title || video.slug}
          </span>
        </nav>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="px-2 min-w-[70px] text-right">
          <SaveIndicator state={saveState} />
        </div>

        <div className="flex items-center gap-0.5 border rounded-md bg-[var(--color-surface)]">
          <Tooltip content="Previous (K)">
            <button
              disabled={!prevSlug}
              onClick={() => prevSlug && router.push(`/videos/${prevSlug}`)}
              className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-fg-secondary)] disabled:opacity-30"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <span className="text-[11px] text-[var(--color-fg-muted)] tabular-nums px-1">
            {index + 1}/{total}
          </span>
          <Tooltip content="Next (J)">
            <button
              disabled={!nextSlug}
              onClick={() => nextSlug && router.push(`/videos/${nextSlug}`)}
              className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-fg-secondary)] disabled:opacity-30"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>

        <Tooltip content={writingMode ? 'Exit writing mode (W)' : 'Writing mode (W)'}>
          <button
            onClick={toggleWritingMode}
            className={cn(
              'p-1.5 rounded border transition-colors',
              writingMode
                ? 'bg-[var(--fg)]/15 border-[var(--line-strong)]/40 text-[var(--fg)]'
                : 'bg-[var(--color-surface)] border-transparent hover:bg-[var(--color-surface-hover)] text-[var(--color-fg-secondary)]'
            )}
          >
            <Feather className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        <Tooltip content={metadataCollapsed ? 'Show metadata (M)' : 'Hide metadata (M)'}>
          <button
            onClick={toggleMetadata}
            className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-fg-secondary)]"
          >
            <PanelRight className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        <Tooltip content={fullscreen ? 'Exit fullscreen (Shift+F)' : 'Fullscreen (Shift+F)'}>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-fg-secondary)]"
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </Tooltip>

        <Tooltip content="Open in Obsidian">
          <a
            href={video.obsidianUri}
            className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-fg-secondary)]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </Tooltip>

        <Tooltip content="Delete video">
          <button
            onClick={() => setConfirmOpen(true)}
            className="p-1.5 rounded hover:bg-[var(--color-danger-subtle)] text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this video?"
        description={`"${video.frontmatter.title || video.slug}" will be moved to trash. You can undo this for a few seconds from the toast.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
      />
    </header>
  );
}
