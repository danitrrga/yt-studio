'use client';

import Link from 'next/link';
import { ExternalLink, Link2, Film, FileText, Hash, Mic, Trash2, Archive } from 'lucide-react';
import { toast } from 'sonner';
import type { HubClipSummary } from '@/lib/types';
import { deleteClipRequest, patchClipRequest, useHubMutate } from '@/hooks/use-hub';
import { cn } from '@/lib/utils';
import { thumbnailSrc } from './hub-utils';

const SOURCE_ICON = {
  youtube: Film,
  article: FileText,
  tweet: Hash,
  podcast: Mic,
  other: Link2,
} as const;

function hostFrom(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function HubCard({ clip }: { clip: HubClipSummary }) {
  const Icon = SOURCE_ICON[clip.frontmatter.source];
  const linkCount = clip.frontmatter.linked_video_slugs.length;
  const mutate = useHubMutate();
  const thumbUrl = thumbnailSrc(clip);
  const isNew = clip.frontmatter.status === 'new';
  const isArchived = clip.frontmatter.status === 'archived';

  const onDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteClipRequest(clip.slug);
      mutate();
      toast.success('Clip moved to trash');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const onArchive = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await patchClipRequest(clip.slug, {
        status: isArchived ? 'read' : 'archived',
      });
      mutate();
      toast.success(isArchived ? 'Unarchived' : 'Archived');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  return (
    <Link
      href={`/hub/${clip.slug}`}
      onClick={(e) => {
        // New-tab / new-window navigations don't update the parent page —
        // skip the "mark as read" PATCH so the badge survives until the
        // user actually opens the clip in this tab.
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (isNew) {
          patchClipRequest(clip.slug, { status: 'read' })
            .then(() => mutate())
            .catch(() => undefined);
        }
      }}
      className={cn(
        'group rounded-lg border bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors overflow-hidden flex flex-col',
        isArchived && 'opacity-55 hover:opacity-90'
      )}
    >
      <div className="aspect-video bg-[var(--color-surface-elevated)] relative overflow-hidden">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--color-fg-muted)]">
            <Icon className="w-10 h-10" />
          </div>
        )}
        {isNew && (
          <span
            className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 h-5 rounded text-[10px] font-medium bg-[var(--fg)] text-black"
            title="New — unread"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-black/70" />
            New
          </span>
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onArchive}
            aria-label={isArchived ? 'Unarchive' : 'Archive'}
            title={isArchived ? 'Unarchive' : 'Archive'}
            className="p-1.5 rounded bg-black/60 text-white hover:bg-black/80"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            aria-label="Delete clip"
            className="p-1.5 rounded bg-black/60 text-white hover:bg-black/80"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-fg-muted)]">
          <Icon className="w-3.5 h-3.5" />
          <span className="truncate">{hostFrom(clip.frontmatter.url)}</span>
          <a
            href={clip.frontmatter.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto opacity-0 group-hover:opacity-100 hover:text-[var(--color-fg)]"
            aria-label="Open URL"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="text-sm font-medium line-clamp-2 leading-snug text-[var(--color-fg)]">
          {clip.frontmatter.title || clip.frontmatter.url}
        </div>
        {clip.frontmatter.description && (
          <div className="text-[11px] text-[var(--color-fg-muted)] line-clamp-2 leading-snug">
            {clip.frontmatter.description}
          </div>
        )}
        <div className="mt-auto flex items-center gap-2 pt-1.5">
          {clip.frontmatter.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-elevated)] text-[var(--color-fg-secondary)]"
            >
              #{t}
            </span>
          ))}
          {linkCount > 0 && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--status-scripting)/0.15)] text-[hsl(var(--status-scripting))] inline-flex items-center gap-1">
              <Link2 className="w-2.5 h-2.5" />
              {linkCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
