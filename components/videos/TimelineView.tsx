'use client';

import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { addDays, format, parseISO } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { VideoSummary } from '@/lib/types';
import type { Density, TimelineZoom } from '@/lib/filter-types';
import {
  buildAxis,
  buildDayCells,
  ZOOM_LABEL,
  ZOOM_LEVELS,
  type TimeAxis,
} from '@/lib/timeline-axis';
import {
  layoutBar,
  partitionVideos,
  type BarLayout,
  type DateKind,
} from '@/lib/timeline-layout';
import { applyDelta, originalDates } from '@/lib/timeline-drag';
import { createDaySnapModifier } from '@/lib/timeline-snap';
import { useActiveView, viewStore } from '@/hooks/use-view-store';
import { selection, useSelectionIds } from '@/hooks/use-selection';
import { updateVideoField } from '@/hooks/use-videos';
import { STATUS_SOLID_VAR, STATUS_LABELS } from '@/lib/status';
import { KIND_HEX, KIND_LABEL } from '@/lib/calendar-events';
import { StatusPill } from '@/components/ui/StatusPill';
import { cn } from '@/lib/utils';

const TITLE_COL_PX = 220;
const ROW_HEIGHTS: Record<Density, number> = {
  compact: 40,
  regular: 56,
  comfortable: 68,
};
const HEADER_H = 68; // month band + day band

type DragKind = 'span' | DateKind | 'nodate';

function parseDragId(id: string): { slug: string; mode: DragKind } {
  const [slug, mode] = id.split('::');
  return { slug, mode: (mode as DragKind) ?? 'span' };
}

export function TimelineView({
  videos,
  onCardClick,
}: {
  videos: VideoSummary[];
  onCardClick: (slug: string) => void;
}) {
  const view = useActiveView();
  const zoom: TimelineZoom = view.timelineZoom ?? 'week';
  const density: Density = view.density ?? 'regular';
  const expanded = view.timelineNoDateExpanded ?? false;
  const rowH = ROW_HEIGHTS[density];
  const { mutate: globalMutate } = useSWRConfig();

  const today = useMemo(() => new Date(), []);
  const axis = useMemo(() => buildAxis(zoom, videos, today), [zoom, videos, today]);

  const { dated, undated } = useMemo(() => partitionVideos(videos), [videos]);

  const baseLayouts = useMemo(
    () =>
      dated
        .map((v) => ({ video: v, bar: layoutBar(v, axis) }))
        .filter((x): x is { video: VideoSummary; bar: BarLayout } => !!x.bar),
    [dated, axis]
  );

  const [activeDragSlug, setActiveDragSlug] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<DragKind>('span');
  const [dragDeltaDays, setDragDeltaDays] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pointerXRef = useRef<number>(0);

  // While a marker is being dragged, recompute the affected video's bar
  // with the marker's date shifted by deltaDays so the bar visually
  // stretches/shrinks live under the cursor.
  const layouts = useMemo(() => {
    const isMarkerDrag =
      dragMode === 'target' || dragMode === 'record' || dragMode === 'published';
    if (!isMarkerDrag || !activeDragSlug || dragDeltaDays === 0) return baseLayouts;
    const field =
      `${dragMode}_date` as 'target_date' | 'record_date' | 'published_date';
    return baseLayouts.map(({ video, bar }) => {
      if (video.slug !== activeDragSlug) return { video, bar };
      const original = video.frontmatter[field];
      if (!original) return { video, bar };
      const shifted = format(addDays(parseISO(original), dragDeltaDays), 'yyyy-MM-dd');
      const previewVideo: VideoSummary = {
        ...video,
        frontmatter: { ...video.frontmatter, [field]: shifted },
      };
      const next = layoutBar(previewVideo, axis);
      return { video, bar: next ?? bar };
    });
  }, [baseLayouts, dragMode, activeDragSlug, dragDeltaDays, axis]);

  const orderedSlugs = useMemo(() => layouts.map((l) => l.video.slug), [layouts]);

  // Track raw pointer x while a drag is in flight so we can compute the
  // drop date independent of dnd-kit's rect/transform internals.
  useEffect(() => {
    if (!activeDragSlug) return;
    const handler = (e: PointerEvent) => {
      pointerXRef.current = e.clientX;
    };
    document.addEventListener('pointermove', handler, { passive: true });
    return () => document.removeEventListener('pointermove', handler);
  }, [activeDragSlug]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const snapModifier = useMemo(
    () => createDaySnapModifier(axis.pxPerDay),
    [axis.pxPerDay]
  );

  // Re-center on today whenever zoom changes.
  useEffect(() => {
    if (!scrollerRef.current) return;
    const scroller = scrollerRef.current;
    const targetX = axis.dateToX(today);
    scroller.scrollLeft = Math.max(0, targetX - scroller.clientWidth / 2 + TITLE_COL_PX);
  }, [zoom, axis, today]);

  const onDragStart = (e: DragStartEvent) => {
    const { slug, mode } = parseDragId(e.active.id as string);
    setActiveDragSlug(slug);
    setDragMode(mode);
    setDragDeltaDays(0);
  };

  const onDragMove = (e: DragMoveEvent) => {
    setDragDeltaDays(Math.round(e.delta.x / axis.pxPerDay));
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { slug, mode } = parseDragId(e.active.id as string);
    setActiveDragSlug(null);
    setDragMode('span');
    setDragDeltaDays(0);

    const video = videos.find((v) => v.slug === slug);
    if (!video) return;
    const title = video.frontmatter.title || video.slug;
    const before = originalDates(video);

    let patch: Record<string, unknown>;
    let label: string;

    // Drop into NoDateZone droppable → clear all dates (unschedule).
    const overId = e.over?.id;
    if (mode !== 'nodate' && overId === 'nodate-drop') {
      patch = {
        target_date: null,
        record_date: null,
        published_date: null,
      };
      label = `${title} unscheduled`;
    } else if (mode === 'nodate') {
      // Use the live pointer x (tracked via a document listener) — most
      // reliable across dnd-kit versions and drop-animation timing.
      const bodyEl = scrollerRef.current;
      if (!bodyEl) return;
      const pointerX = pointerXRef.current;
      const bodyRect = bodyEl.getBoundingClientRect();
      const relX = pointerX - bodyRect.left + bodyEl.scrollLeft;
      const clampedX = Math.max(0, Math.min(axis.totalPx - 1, relX));
      const droppedDate = axis.xToDate(clampedX);
      const iso = format(droppedDate, 'yyyy-MM-dd');
      patch = { target_date: iso };
      label = `${title} · scheduled ${format(droppedDate, 'MMM d')}`;
    } else {
      const dx = e.delta.x;
      const deltaDays = Math.round(dx / axis.pxPerDay);

      if (mode === 'span') {
        if (deltaDays === 0) return;
        patch = applyDelta(video, deltaDays) as Record<string, unknown>;
        label = `${title} shifted ${deltaDays >= 0 ? '+' : ''}${deltaDays}d`;
      } else {
        const field = `${mode}_date` as 'target_date' | 'record_date' | 'published_date';
        const original = video.frontmatter[field];
        if (original) {
          // Existing marker — shift by delta days.
          if (deltaDays === 0) return;
          const newDate = format(addDays(parseISO(original), deltaDays), 'yyyy-MM-dd');
          patch = { [field]: newDate };
          label = `${title} · ${KIND_LABEL[mode]} ${deltaDays >= 0 ? '+' : ''}${deltaDays}d`;
        } else {
          // Placeholder dot for an unset date — drop position determines value.
          const bodyEl = scrollerRef.current;
          if (!bodyEl) return;
          const pointerX = pointerXRef.current;
          const bodyRect = bodyEl.getBoundingClientRect();
          const relX = pointerX - bodyRect.left + bodyEl.scrollLeft;
          const clampedX = Math.max(0, Math.min(axis.totalPx - 1, relX));
          const droppedDate = axis.xToDate(clampedX);
          const iso = format(droppedDate, 'yyyy-MM-dd');
          patch = { [field]: iso };
          label = `${title} · ${KIND_LABEL[mode]} set to ${format(droppedDate, 'MMM d')}`;
        }
      }
    }
    if (Object.keys(patch).length === 0) return;

    // Optimistic: patch SWR cache immediately so the bar snaps to its new
    // position on drop without waiting for the network + file-watcher cycle.
    const optimisticUpdater = (current: VideoSummary[] | undefined) => {
      if (!current) return current;
      return current.map((v) =>
        v.slug === slug
          ? { ...v, frontmatter: { ...v.frontmatter, ...patch } as VideoSummary['frontmatter'] }
          : v
      );
    };
    globalMutate('/api/videos', optimisticUpdater, { revalidate: false });

    try {
      await updateVideoField(slug, patch);
      // Revalidate (also pulls fresh mtime for conflict detection)
      globalMutate('/api/videos');
      toast.success(label, {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: async () => {
            const undoPatch =
              mode === 'span'
                ? (before as Record<string, unknown>)
                : { [`${mode}_date`]: before[`${mode}_date` as keyof typeof before] };
            globalMutate(
              '/api/videos',
              (current: VideoSummary[] | undefined) =>
                current?.map((v) =>
                  v.slug === slug
                    ? {
                        ...v,
                        frontmatter: { ...v.frontmatter, ...undoPatch } as VideoSummary['frontmatter'],
                      }
                    : v
                ),
              { revalidate: false }
            );
            try {
              await updateVideoField(slug, undoPatch);
              globalMutate('/api/videos');
            } catch (err) {
              globalMutate('/api/videos'); // restore truth from disk
              toast.error(err instanceof Error ? err.message : 'Undo failed');
            }
          },
        },
      });
    } catch (err) {
      // Roll back optimistic update by re-fetching from disk
      globalMutate('/api/videos');
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const activeBar = activeDragSlug
    ? layouts.find((l) => l.video.slug === activeDragSlug)
    : null;
  const activeUndatedVideo =
    dragMode === 'nodate' && activeDragSlug
      ? undated.find((v) => v.slug === activeDragSlug)
      : null;

  const scrollToToday = () => {
    if (!scrollerRef.current) return;
    const scroller = scrollerRef.current;
    const targetX = axis.dateToX(today);
    scroller.scrollTo({
      left: Math.max(0, targetX - scroller.clientWidth / 2 + TITLE_COL_PX),
      behavior: 'smooth',
    });
  };

  const scrollBy = (delta: number) =>
    scrollerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      modifiers={[snapModifier]}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveDragSlug(null);
        setDragDeltaDays(0);
      }}
    >
      <div className="rounded-md border bg-[var(--bg-raised)] overflow-hidden">
        <Toolbar
          zoom={zoom}
          onZoom={(z) => viewStore.setTimelineZoom(z)}
          onToday={scrollToToday}
          onPrev={() => scrollBy(-400)}
          onNext={() => scrollBy(400)}
        />

        {undated.length > 0 && (
          <NoDateZone
            videos={undated}
            expanded={expanded}
            onToggle={() => viewStore.setTimelineNoDateExpanded(!expanded)}
            onCardClick={onCardClick}
            activeDragSlug={activeDragSlug}
            activeDragMode={dragMode}
          />
        )}

        <div className="flex">
          {/* Sticky title column */}
          <div className="shrink-0 border-r bg-[var(--bg-raised)]" style={{ width: TITLE_COL_PX }}>
            <div className="border-b" style={{ height: HEADER_H }} />
            {layouts.length === 0 && (
              <div className="px-4 py-12 text-center text-xs text-[var(--fg-dim)]">
                No videos with dates.
              </div>
            )}
            {layouts.map(({ video }) => (
              <RowTitle
                key={video.slug}
                video={video}
                rowH={rowH}
                onClick={() => onCardClick(video.slug)}
              />
            ))}
          </div>

          {/* Scrolling timeline body */}
          <div ref={scrollerRef} className="overflow-x-auto flex-1 relative">
            <div style={{ width: axis.totalPx, position: 'relative' }}>
              <Header axis={axis} today={today} />
              <Body
                layouts={layouts}
                axis={axis}
                rowH={rowH}
                today={today}
                activeDragSlug={activeDragSlug}
                activeDragMode={dragMode}
                orderedSlugs={orderedSlugs}
                onCardClick={onCardClick}
              />
            </div>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeBar && dragMode !== 'nodate' && (
          <BarGhost
            bar={activeBar.bar}
            video={activeBar.video}
            rowH={rowH}
            previewDays={dragDeltaDays}
            mode={dragMode as 'span' | DateKind}
          />
        )}
        {activeUndatedVideo && <NoDateChipGhost video={activeUndatedVideo} />}
      </DragOverlay>
    </DndContext>
  );
}

function Toolbar({
  zoom,
  onZoom,
  onToday,
  onPrev,
  onNext,
}: {
  zoom: TimelineZoom;
  onZoom: (z: TimelineZoom) => void;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b">
      <div className="inline-flex items-center rounded-md border overflow-hidden text-xs">
        {ZOOM_LEVELS.map((z) => (
          <button
            key={z}
            onClick={() => onZoom(z)}
            className={cn(
              'px-2.5 h-7 transition-colors',
              z === zoom
                ? 'bg-[var(--fg)] text-[var(--fg-inverse)]'
                : 'text-[var(--fg-dim)] hover:bg-[var(--bg-hover)]'
            )}
          >
            {ZOOM_LABEL[z]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onPrev} className="p-1.5 rounded hover:bg-[var(--bg-hover)]">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onToday}
          className="px-2 h-7 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] rounded hover:bg-[var(--bg-hover)]"
        >
          Today
        </button>
        <button onClick={onNext} className="p-1.5 rounded hover:bg-[var(--bg-hover)]">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Header({ axis, today }: { axis: TimeAxis; today: Date }) {
  return (
    <div className="sticky top-0 z-10 bg-[var(--bg-raised)] border-b" style={{ height: HEADER_H }}>
      {/* Month band */}
      <div className="relative h-8 border-b border-[var(--line-faint)]">
        {axis.monthBands.map((b, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 flex items-center px-2 font-mono text-[12px] font-medium uppercase tracking-wider text-[var(--fg-muted)] border-r border-[var(--line-faint)]"
            style={{ left: b.x, width: b.width }}
          >
            {b.label}
          </div>
        ))}
      </div>
      {/* Tick band — labels sit OVER gridlines so bars + labels stack */}
      <div className="relative h-9">
        {axis.ticks.map((t, i) => (
          <div
            key={i}
            className={cn(
              'absolute top-0 bottom-0 flex items-center justify-center tabular-nums -translate-x-1/2',
              t.major
                ? 'text-[13px] font-medium text-[var(--fg-muted)]'
                : 'text-[12px] text-[var(--fg-dim)]'
            )}
            style={{
              left: t.x,
              width: Math.max(24, axis.pxPerDay),
            }}
          >
            {t.label}
          </div>
        ))}
      </div>
      {/* Today pill */}
      <TodayPill axis={axis} today={today} />
    </div>
  );
}

function TodayPill({ axis, today }: { axis: TimeAxis; today: Date }) {
  const x = axis.dateToX(today);
  return (
    <div
      className="absolute top-0 -translate-x-1/2 z-20"
      style={{ left: x, height: HEADER_H }}
    >
      <span className="inline-flex items-center justify-center min-w-[28px] h-5 px-2 rounded-full bg-[var(--fg)] text-[var(--fg-inverse)] text-[10px] font-medium tabular-nums">
        {format(today, 'd')}
      </span>
    </div>
  );
}

function Body({
  layouts,
  axis,
  rowH,
  today,
  activeDragSlug,
  activeDragMode,
  orderedSlugs,
  onCardClick,
}: {
  layouts: { video: VideoSummary; bar: BarLayout }[];
  axis: TimeAxis;
  rowH: number;
  today: Date;
  activeDragSlug: string | null;
  activeDragMode: 'span' | DateKind | 'nodate';
  orderedSlugs: string[];
  onCardClick: (slug: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: 'timeline-body' });
  const todayX = axis.dateToX(today);
  const dayCells = useMemo(() => buildDayCells(axis), [axis]);

  return (
    <div ref={setNodeRef} className="relative">
      {/* Weekend tint stripes (day/week zoom only) */}
      {dayCells.map(
        (c, i) =>
          c.isWeekend && (
            <div
              key={`w${i}`}
              className="absolute top-0 bottom-0 bg-[var(--bg-raised)]/30 pointer-events-none"
              style={{ left: c.x, width: c.width }}
            />
          )
      )}

      {/* Per-day vertical gridlines (day/week zoom) */}
      {dayCells.map((c, i) => (
        <div
          key={`g${i}`}
          className={cn(
            'absolute top-0 bottom-0 pointer-events-none',
            c.isMonday
              ? 'border-l border-[var(--line-faint)]'
              : 'border-l border-[var(--line-faint)]/40'
          )}
          style={{ left: c.x }}
        />
      ))}

      {/* Major-tick gridlines (used at month/quarter zoom where day cells empty) */}
      {dayCells.length === 0 &&
        axis.ticks.map((t, i) => (
          <div
            key={`m${i}`}
            className={cn(
              'absolute top-0 bottom-0 pointer-events-none',
              t.major
                ? 'border-l border-[var(--line-faint)]'
                : 'border-l border-[var(--line-faint)]/40'
            )}
            style={{ left: t.x }}
          />
        ))}

      {/* Today line */}
      <div
        className="absolute top-0 bottom-0 z-[5] pointer-events-none"
        style={{ left: todayX, borderLeft: '1.5px solid var(--fg)' }}
      />

      {/* Rows */}
      {layouts.map(({ video, bar }) => (
        <Row
          key={video.slug}
          video={video}
          bar={bar}
          rowH={rowH}
          isBeingDragged={activeDragSlug === video.slug}
          activeDragMode={activeDragMode}
          orderedSlugs={orderedSlugs}
          today={today}
          onCardClick={onCardClick}
        />
      ))}
    </div>
  );
}

function Row({
  video,
  bar,
  rowH,
  isBeingDragged,
  activeDragMode,
  orderedSlugs,
  today,
  onCardClick,
}: {
  video: VideoSummary;
  bar: BarLayout;
  rowH: number;
  isBeingDragged: boolean;
  activeDragMode: 'span' | DateKind | 'nodate';
  orderedSlugs: string[];
  today: Date;
  onCardClick: (slug: string) => void;
}) {
  return (
    <div
      className="relative border-b border-[var(--line-faint)] hover:bg-[var(--bg-hover)]/30"
      style={{ height: rowH }}
    >
      <Bar
        video={video}
        bar={bar}
        rowH={rowH}
        isBeingDragged={isBeingDragged}
        activeDragMode={activeDragMode}
        orderedSlugs={orderedSlugs}
        today={today}
        onCardClick={onCardClick}
      />
    </div>
  );
}

function RowTitle({
  video,
  rowH,
  onClick,
}: {
  video: VideoSummary;
  rowH: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 border-b border-[var(--line-faint)] hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 truncate"
      style={{ height: rowH }}
    >
      <StatusPill status={video.frontmatter.status} size="sm" />
      <span className="text-[13px] text-[var(--fg)] truncate">
        {video.frontmatter.title || video.slug}
      </span>
    </button>
  );
}

function Bar({
  video,
  bar,
  rowH,
  isBeingDragged,
  activeDragMode,
  orderedSlugs,
  today,
  onCardClick,
}: {
  video: VideoSummary;
  bar: BarLayout;
  rowH: number;
  isBeingDragged: boolean;
  activeDragMode: 'span' | DateKind | 'nodate';
  orderedSlugs: string[];
  today: Date;
  onCardClick: (slug: string) => void;
}) {
  const solidVar = STATUS_SOLID_VAR[video.frontmatter.status];
  const todayIso = format(today, 'yyyy-MM-dd');
  const overdue =
    bar.endDate < todayIso && video.frontmatter.status !== 'published';

  const BAR_H = 36;
  const top = (rowH - BAR_H) / 2;
  const isMultiDate = bar.markers.length > 1;

  return (
    <>
      <BarBody
        video={video}
        bar={bar}
        top={top}
        height={BAR_H}
        solidVar={solidVar}
        overdue={overdue}
        isBeingDragged={isBeingDragged && activeDragMode === 'span'}
        orderedSlugs={orderedSlugs}
        onCardClick={onCardClick}
      />
      {/* Markers: only render as separate draggables if multiple dates exist
          (single-date video already has its bar = its only marker).
          Markers on the same date stack vertically inside the row. */}
      {isMultiDate &&
        (() => {
          const KIND_STACK: DateKind[] = ['target', 'record', 'published'];
          const grouped = new Map<string, typeof bar.markers>();
          for (const m of bar.markers) {
            const key = m.date;
            const arr = grouped.get(key) ?? [];
            arr.push(m);
            grouped.set(key, arr);
          }
          for (const arr of grouped.values()) {
            arr.sort(
              (a, b) =>
                KIND_STACK.indexOf(a.kind) - KIND_STACK.indexOf(b.kind)
            );
          }
          return bar.markers.map((m, i) => {
            const stack = grouped.get(m.date)!;
            const stackIndex = stack.indexOf(m);
            const stackCount = stack.length;
            return (
              <MarkerHandle
                key={i}
                slug={video.slug}
                marker={m}
                top={top}
                height={BAR_H}
                stackIndex={stackIndex}
                stackCount={stackCount}
                isBeingDragged={
                  isBeingDragged && (activeDragMode === 'span' || activeDragMode === m.kind)
                }
              />
            );
          });
        })()}
    </>
  );
}

function BarBody({
  video,
  bar,
  top,
  height,
  solidVar,
  overdue,
  isBeingDragged,
  orderedSlugs,
  onCardClick,
}: {
  video: VideoSummary;
  bar: BarLayout;
  top: number;
  height: number;
  solidVar: string;
  overdue: boolean;
  isBeingDragged: boolean;
  orderedSlugs: string[];
  onCardClick: (slug: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `${video.slug}::span`,
  });
  const selectedIds = useSelectionIds();
  const isSelected = selectedIds.has(video.slug);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      e.preventDefault();
      selection.toggleRange(video.slug, orderedSlugs);
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      selection.toggle(video.slug);
      return;
    }
    onCardClick(video.slug);
  };

  const style: React.CSSProperties = {
    left: Math.round(bar.left),
    width: Math.round(bar.width),
    top,
    height,
    transform: isBeingDragged
      ? undefined
      : transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    backgroundColor: `color-mix(in srgb, var(${solidVar}) 14%, transparent)`,
    borderColor: `color-mix(in srgb, var(${solidVar}) 38%, transparent)`,
    color: `var(${solidVar})`,
    visibility: isBeingDragged ? 'hidden' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      {...attributes}
      {...listeners}
      style={style}
      className={cn(
        'absolute rounded border cursor-grab active:cursor-grabbing',
        'flex items-center px-1.5 gap-1',
        'hover:brightness-125 transition-[filter]',
        isSelected && 'bg-[var(--bg-selected)]',
        overdue && 'ring-1 ring-[var(--red)]'
      )}
      title={`${video.frontmatter.title} · ${STATUS_LABELS[video.frontmatter.status]} · ${bar.startDate}${bar.kind === 'span' ? ` → ${bar.endDate}` : ''}`}
    >
      {bar.kind === 'span' && (
        <span className="text-[12px] tabular-nums truncate flex-1 pointer-events-none">
          {video.frontmatter.title || video.slug}
        </span>
      )}
      {/* Inline marker for single-date / point bars */}
      {bar.kind === 'point' && (
        <span
          className="absolute pointer-events-none"
          style={{
            top: '50%',
            left: '50%',
            width: 12,
            height: 12,
            marginTop: -6,
            marginLeft: -6,
            borderRadius: '50%',
            backgroundColor: KIND_HEX[bar.markers[0]?.kind ?? 'target'],
          }}
        />
      )}
    </div>
  );
}

function MarkerHandle({
  slug,
  marker,
  top,
  height,
  stackIndex,
  stackCount,
  isBeingDragged,
}: {
  slug: string;
  marker: { kind: DateKind; offsetX: number; absX: number; date: string; placeholder?: boolean };
  top: number;
  height: number;
  stackIndex: number;
  stackCount: number;
  isBeingDragged: boolean;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `${slug}::${marker.kind}`,
  });
  const color = KIND_HEX[marker.kind];
  const HANDLE = 12;
  const isPlaceholder = !!marker.placeholder;

  // Stack same-date markers vertically inside the row (gap > size = no overlap).
  const STACK_GAP = 13;
  const baseTop = top + (height - HANDLE) / 2;
  const stackOffset = (stackIndex - (stackCount - 1) / 2) * STACK_GAP;

  // Snap to integer pixels — fractional left causes subpixel anti-aliasing
  // that visually distorts circles into ovals.
  const style: React.CSSProperties = {
    left: Math.round(marker.absX - HANDLE / 2),
    top: Math.round(baseTop + stackOffset),
    width: HANDLE,
    height: HANDLE,
    borderRadius: '50%',
    boxSizing: 'border-box',
    visibility: isBeingDragged ? 'hidden' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={(e) => e.stopPropagation()}
      title={
        isPlaceholder
          ? `${KIND_LABEL[marker.kind]} unset — drag to a day to set`
          : `${KIND_LABEL[marker.kind]} · ${marker.date} (drag to change)`
      }
      style={{
        ...style,
        backgroundColor: isPlaceholder ? 'transparent' : color,
        border: isPlaceholder
          ? `1px dashed ${color}`
          : `1px solid rgba(0, 0, 0, 0.55)`,
        opacity: isPlaceholder ? 0.6 : 1,
      }}
      className={cn(
        'absolute z-[2] cursor-grab active:cursor-grabbing',
        'transition-transform duration-150 ease-out hover:scale-125 hover:z-[3]',
        isPlaceholder && 'hover:opacity-100'
      )}
    />
  );
}

function NoDateChipGhost({ video }: { video: VideoSummary }) {
  const solidVar = STATUS_SOLID_VAR[video.frontmatter.status];
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 h-[22px] rounded border text-[11px]"
      style={{
        backgroundColor: `color-mix(in srgb, var(${solidVar}) 28%, transparent)`,
        borderColor: `color-mix(in srgb, var(${solidVar}) 60%, transparent)`,
        color: `var(${solidVar})`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: `var(${solidVar})` }}
      />
      <span className="truncate max-w-[180px]">
        {video.frontmatter.title || video.slug}
      </span>
    </div>
  );
}

function BarGhost({
  bar,
  video,
  rowH,
  previewDays,
  mode,
}: {
  bar: BarLayout;
  video: VideoSummary;
  rowH: number;
  previewDays: number;
  mode: 'span' | DateKind;
}) {
  const solidVar = STATUS_SOLID_VAR[video.frontmatter.status];
  const showPill = previewDays !== 0;
  const sign = previewDays > 0 ? '+' : '';

  // Ghost shape depends on drag mode.
  if (mode !== 'span') {
    // Single-marker drag — render just the dot ghost + pill
    const original = bar.markers.find((m) => m.kind === mode)?.date ?? bar.startDate;
    const newDate = format(addDays(parseISO(original), previewDays), 'MMM d');
    const color = KIND_HEX[mode];
    return (
      <div className="relative">
        {showPill && (
          <div
            className="absolute left-1/2 -translate-x-1/2 -top-7 inline-flex items-center gap-1.5 h-5 px-2 rounded-full border bg-[var(--bg-raised)] text-[10px] tabular-nums whitespace-nowrap z-10"
            style={{ borderColor: `color-mix(in srgb, ${color} 50%, transparent)` }}
          >
            <span className="font-mono text-[var(--fg-dim)] uppercase tracking-wider text-[9px]">
              {KIND_LABEL[mode]}
            </span>
            <span>{newDate}</span>
            <span className="font-medium" style={{ color }}>
              {sign}{previewDays}d
            </span>
          </div>
        )}
        <div
          className=""
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            backgroundColor: color,
          }}
        />
      </div>
    );
  }

  const newStart = format(addDays(parseISO(bar.startDate), previewDays), 'MMM d');
  const newEnd = format(addDays(parseISO(bar.endDate), previewDays), 'MMM d');

  return (
    <div className="relative" style={{ width: bar.width }}>
      {showPill && (
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-7 inline-flex items-center gap-1.5 h-5 px-2 rounded-full border bg-[var(--bg-raised)] text-[10px] tabular-nums whitespace-nowrap z-10"
          style={{ borderColor: `color-mix(in srgb, var(${solidVar}) 40%, transparent)`, color: 'var(--fg)' }}
        >
          <span>{newStart}</span>
          {bar.kind === 'span' && (
            <>
              <span className="text-[var(--fg-dim)]">→</span>
              <span>{newEnd}</span>
            </>
          )}
          <span className="text-[var(--fg)] font-medium">{sign}{previewDays}d</span>
        </div>
      )}
      <div
        className="rounded border flex items-center px-1.5 gap-1"
        style={{
          width: bar.width,
          height: 22,
          backgroundColor: `color-mix(in srgb, var(${solidVar}) 28%, transparent)`,
          borderColor: `color-mix(in srgb, var(${solidVar}) 60%, transparent)`,
          color: `var(${solidVar})`,
        }}
      >
        {bar.kind === 'span' && (
          <span className="text-[10px] tabular-nums truncate flex-1">
            {video.frontmatter.title || video.slug}
          </span>
        )}
      </div>
    </div>
  );
}

function NoDateZone({
  videos,
  expanded,
  onToggle,
  onCardClick,
  activeDragSlug,
  activeDragMode,
}: {
  videos: VideoSummary[];
  expanded: boolean;
  onToggle: () => void;
  onCardClick: (slug: string) => void;
  activeDragSlug: string | null;
  activeDragMode: 'span' | DateKind | 'nodate';
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'nodate-drop' });
  const isDraggingDated = !!activeDragSlug && activeDragMode !== 'nodate';

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'border-b bg-[var(--bg-raised)]/30 transition-colors',
        isOver && 'bg-[color-mix(in_srgb,var(--red)_6%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--red)_40%,transparent)] ring-inset'
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left font-mono text-[12px] font-medium uppercase tracking-wider text-[var(--fg-dim)] hover:text-[var(--fg)]"
      >
        <span className="inline-block w-3 transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}>▸</span>
        No date <span className="text-[var(--fg-dim)] normal-case font-normal">({videos.length})</span>
        {expanded && !isDraggingDated && (
          <span className="ml-2 normal-case font-normal text-[var(--fg-dim)] tracking-normal text-[10px]">
            drag onto timeline to set a plan date
          </span>
        )}
        {isDraggingDated && (
          <span className="ml-2 normal-case font-normal text-[var(--fg-muted)] tracking-normal text-[10px]">
            drop here to unschedule
          </span>
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 flex flex-wrap gap-2">
          {videos.map((v) => (
            <NoDateChip
              key={v.slug}
              video={v}
              isBeingDragged={activeDragSlug === v.slug && activeDragMode === 'nodate'}
              onClick={() => onCardClick(v.slug)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NoDateChip({
  video,
  isBeingDragged,
  onClick,
}: {
  video: VideoSummary;
  isBeingDragged: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `${video.slug}::nodate`,
  });
  const solidVar = STATUS_SOLID_VAR[video.frontmatter.status];
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 h-[26px] rounded border text-[13px] cursor-grab active:cursor-grabbing transition-[filter] shrink-0',
        'hover:brightness-125'
      )}
      style={{
        backgroundColor: `color-mix(in srgb, var(${solidVar}) 18%, transparent)`,
        borderColor: `color-mix(in srgb, var(${solidVar}) 45%, transparent)`,
        color: `var(${solidVar})`,
        visibility: isBeingDragged ? 'hidden' : undefined,
      }}
      title={`${video.frontmatter.title || video.slug} — drag to schedule`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: `var(${solidVar})` }}
      />
      <span className="truncate max-w-[180px] tabular-nums">
        {video.frontmatter.title || video.slug}
      </span>
    </button>
  );
}
