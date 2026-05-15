'use client';

import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Target } from 'lucide-react';
import type { VideoSummary } from '@/lib/types';
import { selection, useSelectionIds } from '@/hooks/use-selection';
import { StatusPill } from '@/components/ui/StatusPill';
import { Checkbox } from '@/components/ui/Checkbox';
import { ThumbnailPreview } from '@/components/detail/ThumbnailUploader';
import { cn } from '@/lib/utils';

function fmt(d: string | null) {
  if (!d) return null;
  try { return format(parseISO(d), 'MMM d'); } catch { return d; }
}

export function GalleryView({
  videos,
  onCardClick,
}: {
  videos: VideoSummary[];
  onCardClick: (slug: string) => void;
}) {
  const selected = useSelectionIds();
  const ordered = videos.map((v) => v.slug);

  const handleClick = (e: React.MouseEvent, slug: string) => {
    if (e.shiftKey) {
      e.preventDefault();
      selection.toggleRange(slug, ordered);
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      selection.toggle(slug);
      return;
    }
    onCardClick(slug);
  };

  if (videos.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-[var(--color-fg-muted)]">
        No videos.
      </div>
    );
  }

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
    >
      {videos.map((v) => {
        const isSelected = selected.has(v.slug);
        return (
          <motion.div
            key={v.slug}
            layout
            onClick={(e) => handleClick(e, v.slug)}
            className={cn(
              'group rounded-lg border bg-[var(--color-surface-elevated)] overflow-hidden cursor-pointer',
              'hover:border-[var(--color-border)] transition-colors',
              isSelected && 'bg-[var(--bg-selected)] border-[var(--line-strong)]'
            )}
          >
            <div className="aspect-video w-full bg-[var(--color-surface)] overflow-hidden relative">
              <ThumbnailPreview slug={v.slug} />
              <div
                className={cn(
                  'absolute top-2 right-2 transition-opacity',
                  isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onChange={() => selection.toggle(v.slug)}
                  title="Toggle selection"
                />
              </div>
            </div>
            <div className="p-3 space-y-2">
              <div className="font-medium text-sm line-clamp-2 leading-snug">
                {v.frontmatter.title || v.slug}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusPill status={v.frontmatter.status} size="sm" />
                {v.frontmatter.target_date && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-fg-muted)] tabular-nums">
                    <Target className="w-3 h-3" />
                    {fmt(v.frontmatter.target_date)}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
