'use client';

import { Search } from 'lucide-react';
import { useActiveView, viewStore } from '@/hooks/use-view-store';
import { FilterChipRow } from './FilterChipRow';
import { SortPill } from './SortPopover';
import type { VideoSummary } from '@/lib/types';
import type { Condition } from '@/lib/filter-types';

export function FilterBar({ videos }: { videos: VideoSummary[] }) {
  const view = useActiveView();
  const conds = view.filter.children.filter((c) => (c as Condition).kind === 'cond');
  const hasFilters = conds.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-fg-muted)]" />
          <input
            type="text"
            placeholder="Search videos..."
            value={view.search}
            onChange={(e) => viewStore.setSearch(e.target.value)}
            className="h-7 pl-8 pr-3 w-56 rounded-md border bg-[var(--color-surface)] text-xs outline-none"
          />
        </div>

        {!hasFilters && (
          <>
            <div className="h-4 w-px bg-[var(--color-border-subtle)]" />
            <FilterChipRow videos={videos} />
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <SortPill />
        </div>
      </div>

      {hasFilters && (
        <div className="flex items-center gap-2 pt-1 border-t border-[var(--color-border-subtle)]">
          <FilterChipRow videos={videos} />
        </div>
      )}
    </div>
  );
}
