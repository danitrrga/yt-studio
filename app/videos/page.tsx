'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Filter, Film, Inbox as InboxIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useVideos } from '@/hooks/use-videos';
import { INBOX_VIEW_KEY, getBuiltinByUrlKey } from '@/lib/view-persistence';
import { useUI } from '@/components/UIProvider';
import { FilterBar } from '@/components/videos/FilterBar';
import { ViewSwitcher, type ViewMode } from '@/components/videos/ViewSwitcher';
import { TableView } from '@/components/videos/TableView';
import { KanbanView } from '@/components/videos/KanbanView';
import { CalendarView } from '@/components/videos/CalendarView';
import { TimelineView } from '@/components/videos/TimelineView';
import { GalleryView } from '@/components/videos/GalleryView';
import { Toolbar } from '@/components/videos/Toolbar';
import { BulkBar } from '@/components/videos/BulkBar';
import { VideoDetailPanel } from '@/components/detail/VideoDetailPanel';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { useActiveView, useActiveViewMode, viewStore } from '@/hooks/use-view-store';
import { useViewPersist } from '@/hooks/use-view-persist';
import { applyFilter } from '@/lib/filter-apply';
import { applySort } from '@/lib/filter-sort';
import { cn } from '@/lib/utils';

export default function VideosPage() {
  return (
    <Suspense fallback={<SkeletonTable rows={8} />}>
      <VideosPageInner />
    </Suspense>
  );
}

function VideosPageInner() {
  useViewPersist();
  const { videos, isLoading, mutate } = useVideos();
  const { focus, setQuickAddOpen } = useUI();
  const searchParams = useSearchParams();
  const activeView = useActiveViewMode();
  const view = useActiveView();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const urlPreset = searchParams.get('v');
  const isInbox = urlPreset === INBOX_VIEW_KEY;
  const builtin = urlPreset ? getBuiltinByUrlKey(urlPreset) : null;
  const pageTitle = isInbox ? 'Inbox' : (builtin?.name ?? 'Videos');
  const pageSubtitle = isInbox
    ? 'Ideas awaiting triage'
    : (builtin?.description ?? null);

  const setView = (v: ViewMode) => viewStore.setActiveView(v);

  const filtered = useMemo(() => {
    if (!videos) return [];
    const f = applyFilter(videos, view.filter, view.search);
    return applySort(f, view.sort);
  }, [videos, view.filter, view.search, view.sort]);

  return (
    <div
      className={cn(
        'space-y-4 transition-[padding] duration-200',
        focus ? 'px-4 py-3' : 'px-8 py-6 space-y-6 max-w-[1800px] mx-auto'
      )}
    >
      <div className="flex items-center justify-between gap-4">
        {focus ? (
          <div className="flex items-baseline gap-3">
            <h1 className="text-base font-semibold tracking-tight">{pageTitle}</h1>
            <span className="text-xs text-[var(--color-fg-muted)] tabular-nums">
              {filtered.length}/{videos?.length ?? 0}
            </span>
          </div>
        ) : (
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.012em] leading-[1.2]">{pageTitle}</h1>
            <p className="text-[13px] text-[var(--color-fg-muted)] mt-1">
              {pageSubtitle ?? `${filtered.length} of ${videos?.length ?? 0}`}
            </p>
          </div>
        )}
        <ViewSwitcher value={activeView} onChange={setView} />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <FilterBar videos={videos ?? []} />
        </div>
        {(activeView === 'table' || activeView === 'kanban' || activeView === 'gallery') && (
          <Toolbar filtered={filtered} mode={activeView} />
        )}
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} />
      ) : filtered.length === 0 && isInbox ? (
        <EmptyState
          icon={InboxIcon}
          title="No ideas yet"
          body="Press C to capture something you don't want to lose."
          cta={{
            label: 'New idea',
            onClick: () => setQuickAddOpen(true),
            shortcut: ['C'],
          }}
        />
      ) : filtered.length === 0 && (videos?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Film}
          title="No videos yet"
          body="Press C to capture your first video idea, or check your content path in Settings."
          cta={{
            label: 'New video',
            onClick: () => setQuickAddOpen(true),
            shortcut: ['C'],
          }}
        />
      ) : filtered.length === 0 && (videos?.length ?? 0) > 0 ? (
        <EmptyState
          icon={Filter}
          title="No videos match these filters"
          body="Try removing a filter, broadening your search, or clearing everything."
          cta={{
            label: 'Clear filters',
            onClick: () => { viewStore.clearFilters(); viewStore.setSearch(''); },
          }}
        />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {activeView === 'table' && (
              <TableView videos={filtered} onRowClick={setActiveSlug} onMutate={mutate} />
            )}
            {activeView === 'kanban' && (
              <KanbanView videos={filtered} onCardClick={setActiveSlug} onMutate={mutate} />
            )}
            {activeView === 'calendar' && (
              <CalendarView videos={filtered} onCardClick={setActiveSlug} />
            )}
            {activeView === 'timeline' && (
              <TimelineView videos={filtered} onCardClick={setActiveSlug} />
            )}
            {activeView === 'gallery' && (
              <GalleryView videos={filtered} onCardClick={setActiveSlug} />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <VideoDetailPanel
        slug={activeSlug}
        onClose={() => setActiveSlug(null)}
        onMutate={mutate}
      />

      {(activeView === 'table' ||
        activeView === 'kanban' ||
        activeView === 'gallery' ||
        activeView === 'timeline') && <BulkBar videos={filtered} onMutate={mutate} />}
    </div>
  );
}
