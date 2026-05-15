'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, ExternalLink, FileText, Library, Trash2 } from 'lucide-react';
import { useHubClips } from '@/hooks/use-hub';
import { useHubPages } from '@/hooks/use-videos';
import { HubCaptureBox } from '@/components/hub/HubCaptureBox';
import { HubCard } from '@/components/hub/HubCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/utils';
import type { HubSource, HubClipStatus } from '@/lib/types';

type SortKey = 'newest' | 'oldest' | 'most-linked' | 'title';
type StatusTab = 'inbox' | 'all' | HubClipStatus;

const SOURCE_FILTER: { id: HubSource | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'article', label: 'Articles' },
  { id: 'tweet', label: 'Tweets' },
  { id: 'podcast', label: 'Podcasts' },
  { id: 'other', label: 'Other' },
];

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'read', label: 'Read' },
  { id: 'archived', label: 'Archived' },
];

export default function HubPage() {
  const { clips, isLoading } = useHubClips();
  const [statusTab, setStatusTab] = useState<StatusTab>('inbox');
  const [sourceFilter, setSourceFilter] = useState<HubSource | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [showRefDocs, setShowRefDocs] = useState(false);

  const statusCounts = useMemo(() => {
    const counts = { new: 0, read: 0, archived: 0 } as Record<HubClipStatus, number>;
    for (const c of clips ?? []) counts[c.frontmatter.status]++;
    return counts;
  }, [clips]);

  const filtered = useMemo(() => {
    if (!clips) return [];
    let out = clips;
    // Status tab — Inbox = new+read (hide archived); All = everything
    if (statusTab === 'inbox') {
      out = out.filter((c) => c.frontmatter.status !== 'archived');
    } else if (statusTab !== 'all') {
      out = out.filter((c) => c.frontmatter.status === statusTab);
    }
    if (sourceFilter !== 'all') {
      out = out.filter((c) => c.frontmatter.source === sourceFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (c) =>
          c.frontmatter.title.toLowerCase().includes(q) ||
          c.frontmatter.description.toLowerCase().includes(q) ||
          c.frontmatter.url.toLowerCase().includes(q) ||
          c.frontmatter.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    const sorted = [...out];
    switch (sort) {
      case 'newest':
        sorted.sort((a, b) =>
          b.frontmatter.created_at.localeCompare(a.frontmatter.created_at)
        );
        break;
      case 'oldest':
        sorted.sort((a, b) =>
          a.frontmatter.created_at.localeCompare(b.frontmatter.created_at)
        );
        break;
      case 'most-linked':
        sorted.sort(
          (a, b) =>
            b.frontmatter.linked_video_slugs.length -
            a.frontmatter.linked_video_slugs.length
        );
        break;
      case 'title':
        sorted.sort((a, b) =>
          (a.frontmatter.title || a.slug).localeCompare(
            b.frontmatter.title || b.slug
          )
        );
        break;
    }
    return sorted;
  }, [clips, statusTab, sourceFilter, search, sort]);

  return (
    <div className="px-8 py-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.012em] leading-[1.2]">Hub</h1>
          <p className="text-[13px] text-[var(--color-fg-muted)] mt-1">
            capture inspiration before it becomes a script
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--color-fg-muted)]">
          <span className="tabular-nums">
            {clips ? `${clips.length} clip${clips.length === 1 ? '' : 's'}` : ''}
          </span>
          <Link
            href="/hub/trash"
            className="inline-flex items-center gap-1 hover:text-[var(--color-fg)]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Trash
          </Link>
        </div>
      </div>

      <HubCaptureBox />

      <div className="flex items-center gap-1 border-b">
        {STATUS_TABS.map((t) => {
          const count =
            t.id === 'inbox'
              ? statusCounts.new + statusCounts.read
              : t.id === 'all'
                ? (clips?.length ?? 0)
                : statusCounts[t.id];
          return (
            <button
              key={t.id}
              onClick={() => setStatusTab(t.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 h-9 text-xs border-b-2 -mb-px transition-colors',
                statusTab === t.id
                  ? 'border-[var(--fg)] text-[var(--color-fg)]'
                  : 'border-transparent text-[var(--color-fg-secondary)] hover:text-[var(--color-fg)]'
              )}
            >
              {t.label}
              <span className="text-[10px] tabular-nums text-[var(--color-fg-muted)]">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {SOURCE_FILTER.map((s) => (
          <button
            key={s.id}
            onClick={() => setSourceFilter(s.id)}
            className={cn(
              'px-2.5 h-7 rounded-md text-xs border transition-colors',
              sourceFilter === s.id
                ? 'bg-[var(--fg)] text-[var(--fg-inverse)] border-transparent'
                : 'bg-[var(--color-surface)] text-[var(--color-fg-secondary)] hover:bg-[var(--color-surface-hover)]'
            )}
          >
            {s.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <input
            type="search"
            placeholder="Search clips…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 px-2.5 rounded-md border bg-[var(--color-surface)] text-xs outline-none w-48"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-7 px-2 rounded-md border bg-[var(--color-surface)] text-xs outline-none"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="most-linked">Most linked</option>
            <option value="title">A–Z</option>
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-[var(--color-surface)] overflow-hidden">
              <div className="aspect-video">
                <Skeleton variant="row" />
              </div>
              <div className="p-3 space-y-2">
                <Skeleton variant="row" />
                <Skeleton variant="row" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && (clips?.length ?? 0) === 0 && (
        <EmptyState
          icon={Library}
          title="No clips yet"
          body="Paste any URL above to capture inspiration. Articles, YouTube videos, tweets, podcasts — everything that might become a video."
        />
      )}

      {!isLoading && filtered.length === 0 && (clips?.length ?? 0) > 0 && (
        <div className="py-12 text-center text-sm text-[var(--color-fg-muted)]">
          No clips match. Clear the filter or search.
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((clip) => (
            <HubCard key={clip.slug} clip={clip} />
          ))}
        </div>
      )}

      <ReferenceDocs
        showRefDocs={showRefDocs}
        setShowRefDocs={setShowRefDocs}
      />
    </div>
  );
}

function ReferenceDocs({
  showRefDocs,
  setShowRefDocs,
}: {
  showRefDocs: boolean;
  setShowRefDocs: (b: boolean) => void;
}) {
  const { pages } = useHubPages();
  if (!pages || pages.length === 0) return null;
  return (
    <section className="pt-6 border-t border-[var(--color-border-subtle)]">
      <button
        onClick={() => setShowRefDocs(!showRefDocs)}
        className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
      >
        {showRefDocs ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
        Reference docs ({pages.length})
      </button>
      {showRefDocs && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          {pages.map((p) => (
            <Link
              key={p.slug}
              href={`/hub/docs/${p.slug}`}
              className="group rounded-lg border bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors p-4 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-[var(--color-fg-muted)] shrink-0" />
                  <h3 className="font-semibold text-sm truncate">{p.title}</h3>
                </div>
                <a
                  href={p.obsidianUri}
                  title="Open in Obsidian"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[var(--color-fg-muted)] hover:text-[var(--fg)] shrink-0 opacity-0 group-hover:opacity-100"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <p className="text-[11px] text-[var(--color-fg-secondary)] line-clamp-3 leading-relaxed">
                {p.content.trim().slice(0, 220) || (
                  <span className="italic text-[var(--color-fg-muted)]">empty</span>
                )}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
