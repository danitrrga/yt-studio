'use client';

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  useDroppable,
  type CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, GripVertical, Plus } from 'lucide-react';
import type { VideoSummary, VideoStatus } from '@/lib/types';
import type { Density } from '@/lib/filter-types';
import { STATUS_ORDER, STATUS_LABELS, STATUS_SOLID_VAR, IN_FLIGHT_STATUSES } from '@/lib/status';
import { updateVideoField } from '@/hooks/use-videos';
import { useActiveView, viewStore } from '@/hooks/use-view-store';
import { useUI } from '@/components/UIProvider';
import { selection, useSelectionIds } from '@/hooks/use-selection';
import {
  orderColumn,
  setColumnOrder,
  removeFromColumn,
  insertIntoColumn,
} from '@/lib/kanban-order';
import { Badge } from '@/components/ui/Badge';
import { ThumbnailPreview } from '@/components/detail/ThumbnailUploader';
import { cn } from '@/lib/utils';

const WIP_THRESHOLD = 3;
const WIP_TRACKED = IN_FLIGHT_STATUSES;

function fmt(d: string | null) {
  if (!d) return null;
  try { return format(parseISO(d), 'MMM d'); } catch { return d; }
}

export function KanbanView({
  videos,
  onCardClick,
  onMutate,
}: {
  videos: VideoSummary[];
  onCardClick: (slug: string) => void;
  onMutate: () => void;
}) {
  const view = useActiveView();
  const density: Density = view.density ?? 'regular';
  const collapsed = useMemo(() => new Set(view.kanbanCollapsed ?? []), [view.kanbanCollapsed]);
  const [activeDragSlug, setActiveDragSlug] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const bySlug = useMemo(() => new Map(videos.map((v) => [v.slug, v])), [videos]);

  // Per-column ordered slug arrays. Mirrored locally so we can shift cards
  // visually during drag-over before persisting.
  const [columns, setColumns] = useState<Record<VideoStatus, string[]>>(() => {
    const acc = {} as Record<VideoStatus, string[]>;
    for (const s of STATUS_ORDER) acc[s] = [];
    return acc;
  });

  // Re-derive columns whenever the underlying video list changes.
  useEffect(() => {
    const next = {} as Record<VideoStatus, string[]>;
    for (const s of STATUS_ORDER) {
      const items = videos.filter((v) => v.frontmatter.status === s);
      next[s] = orderColumn(s, items).map((v) => v.slug);
    }
    setColumns(next);
  }, [videos]);

  const orderedSlugs = useMemo(
    () => STATUS_ORDER.flatMap((s) => columns[s] ?? []),
    [columns]
  );

  const findContainer = (slug: string): VideoStatus | null => {
    for (const s of STATUS_ORDER) {
      if (columns[s]?.includes(slug)) return s;
    }
    return null;
  };

  const onDragStart = (e: DragStartEvent) => {
    setActiveDragSlug(e.active.id as string);
  };

  const resolveOverContainer = (overId: string): VideoStatus | null => {
    if (STATUS_ORDER.includes(overId as VideoStatus)) return overId as VideoStatus;
    return findContainer(overId);
  };

  const onDragOver = (e: DragOverEvent) => {
    const activeId = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId) return;
    const fromCol = findContainer(activeId);
    const toCol = resolveOverContainer(overId);
    if (!fromCol || !toCol || fromCol === toCol) return;

    setColumns((prev) => {
      const fromList = prev[fromCol].filter((s) => s !== activeId);
      const toList = [...prev[toCol]];
      // If overId is a card in toCol, insert at its index; else append.
      const idx = toList.indexOf(overId);
      if (idx >= 0) toList.splice(idx, 0, activeId);
      else toList.push(activeId);
      return { ...prev, [fromCol]: fromList, [toCol]: toList };
    });
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const activeId = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    setActiveDragSlug(null);
    if (!overId) return;

    const fromCol = (() => {
      const v = bySlug.get(activeId);
      return v ? v.frontmatter.status : null;
    })();
    const toCol = resolveOverContainer(overId);
    if (!fromCol || !toCol) return;

    // Same-column reorder: arrayMove if hovering a sibling card.
    if (fromCol === toCol) {
      setColumns((prev) => {
        const list = prev[toCol];
        const oldIdx = list.indexOf(activeId);
        const newIdx = STATUS_ORDER.includes(overId as VideoStatus)
          ? list.length - 1
          : list.indexOf(overId);
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return prev;
        const next = arrayMove(list, oldIdx, newIdx);
        setColumnOrder(toCol, next);
        return { ...prev, [toCol]: next };
      });
      return;
    }

    // Cross-column: update status, persist new ordering.
    const current = bySlug.get(activeId);
    if (!current) return;
    const title = current.frontmatter.title || current.slug;
    const prevStatus = current.frontmatter.status;

    // Persist current local state for both columns
    const finalToList = columns[toCol];
    setColumnOrder(toCol, finalToList);
    removeFromColumn(prevStatus, activeId);

    try {
      await updateVideoField(activeId, { status: toCol });
      onMutate();
      toast.success(`${title} → ${STATUS_LABELS[toCol]}`, {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await updateVideoField(activeId, { status: prevStatus });
              insertIntoColumn(prevStatus, activeId);
              onMutate();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Undo failed');
            }
          },
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Status change failed');
    }
  };

  const toggleCollapsed = (status: VideoStatus) => {
    const next = new Set(collapsed);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    viewStore.setKanbanCollapsed(Array.from(next));
  };

  const activeDragVideo = activeDragSlug ? bySlug.get(activeDragSlug) : null;

  // Custom collision: prefer pointer-within (stable for overlapping containers),
  // fall back to rect intersection.
  const collisionDetection: CollisionDetection = (args) => {
    const pointer = pointerWithin(args);
    if (pointer.length > 0) return pointer;
    return rectIntersection(args);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveDragSlug(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUS_ORDER.map((s) => {
          const slugs = columns[s] ?? [];
          const items = slugs
            .map((slug) => bySlug.get(slug))
            .filter((v): v is VideoSummary => !!v);
          return (
            <Column
              key={s}
              status={s}
              videos={items}
              slugs={slugs}
              collapsed={collapsed.has(s)}
              density={density}
              orderedSlugs={orderedSlugs}
              activeDragSlug={activeDragSlug}
              onToggleCollapsed={() => toggleCollapsed(s)}
              onCardClick={onCardClick}
            />
          );
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeDragVideo ? (
          <DragGhost video={activeDragVideo} density={density} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DragGhost({ video, density }: { video: VideoSummary; density: Density }) {
  const showThumbnail = density !== 'compact';
  return (
    <div
      className={cn(
        'rounded-md border bg-[var(--bg-raised)] overflow-hidden w-72'
      )}
    >
      {showThumbnail && (
        <div className="aspect-video w-full bg-[var(--bg-raised)] overflow-hidden">
          <ThumbnailPreview slug={video.slug} />
        </div>
      )}
      <div className={cn(showThumbnail ? 'p-3' : 'p-2.5')}>
        <div className="font-medium text-sm line-clamp-2">
          {video.frontmatter.title || video.slug}
        </div>
      </div>
    </div>
  );
}

function Column({
  status,
  videos,
  slugs,
  collapsed,
  density,
  orderedSlugs,
  activeDragSlug,
  onToggleCollapsed,
  onCardClick,
}: {
  status: VideoStatus;
  videos: VideoSummary[];
  slugs: string[];
  collapsed: boolean;
  density: Density;
  orderedSlugs: string[];
  activeDragSlug: string | null;
  onToggleCollapsed: () => void;
  onCardClick: (slug: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const solidVar = STATUS_SOLID_VAR[status];
  const { openQuickAdd } = useUI();

  const overWip = WIP_TRACKED.includes(status) && videos.length > WIP_THRESHOLD;

  if (collapsed) {
    return (
      <button
        type="button"
        ref={setNodeRef}
        onClick={onToggleCollapsed}
        className={cn(
          'w-12 shrink-0 rounded-md border bg-[var(--bg-raised)] flex flex-col items-center py-3 gap-3',
          'hover:bg-[var(--bg-hover)] transition-colors',
          isOver && 'border-[var(--line-strong)]'
        )}
        title={`Expand ${STATUS_LABELS[status]}`}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: `var(${solidVar})` }}
        />
        <span
          className="font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)]"
          style={{ writingMode: 'vertical-rl' }}
        >
          {STATUS_LABELS[status]}
        </span>
        <span className="mt-auto text-[10px] tabular-nums text-[var(--fg-dim)]">
          {videos.length}
        </span>
      </button>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col w-72 shrink-0 rounded-md border bg-[var(--bg-raised)] transition-colors',
        isOver && 'border-[var(--line-strong)]'
      )}
      style={
        isOver
          ? { backgroundColor: `color-mix(in srgb, var(${solidVar}) 4%, transparent)` }
          : undefined
      }
    >
      <div className="px-3 h-10 border-b flex items-center justify-between">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex items-center gap-2 text-[var(--fg-muted)] hover:text-[var(--fg)]"
          title="Collapse"
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: `var(${solidVar})` }}
          />
          <span className="font-mono text-xs font-medium uppercase tracking-wider">
            {STATUS_LABELS[status]}
          </span>
          <ChevronLeft className="w-3 h-3 opacity-60" />
        </button>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded text-[10px] tabular-nums font-medium border transition-colors',
              overWip
                ? 'border-[color-mix(in_srgb,var(--red)_50%,transparent)] bg-[var(--red-wash)] text-[var(--fg-muted)]'
                : 'border-transparent text-[var(--fg-dim)]'
            )}
            title={overWip ? `WIP > ${WIP_THRESHOLD}` : undefined}
          >
            {videos.length}
          </span>
          <button
            type="button"
            onClick={() => openQuickAdd({ status })}
            className="inline-flex items-center justify-center w-5 h-5 rounded text-[var(--fg-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
            title={`Add to ${STATUS_LABELS[status]}`}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
      <SortableContext items={slugs} strategy={verticalListSortingStrategy}>
        <div className="p-2 space-y-2 flex-1 min-h-[200px]">
          {videos.map((v) => (
            <KanbanCard
              key={v.slug}
              video={v}
              density={density}
              orderedSlugs={orderedSlugs}
              isBeingDragged={activeDragSlug === v.slug}
              onClick={() => onCardClick(v.slug)}
            />
          ))}
          {videos.length === 0 && <EmptyDropZone onAdd={() => openQuickAdd({ status })} />}
        </div>
      </SortableContext>
    </div>
  );
}

function EmptyDropZone({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        'w-full rounded-md border border-dashed text-xs text-[var(--fg-dim)]',
        'py-6 flex flex-col items-center justify-center gap-1.5',
        'hover:bg-[var(--bg-hover)] hover:text-[var(--fg)] transition-colors'
      )}
    >
      <Plus className="w-3.5 h-3.5 opacity-60" />
      Drop here or click to add
    </button>
  );
}

function KanbanCard({
  video,
  density,
  orderedSlugs,
  isBeingDragged,
  onClick,
}: {
  video: VideoSummary;
  density: Density;
  orderedSlugs: string[];
  isBeingDragged: boolean;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({ id: video.slug });
  const selectedIds = useSelectionIds();
  const isSelected = selectedIds.has(video.slug);

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const onCardClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      selection.toggleRange(video.slug, orderedSlugs);
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      selection.toggle(video.slug);
      return;
    }
    onClick();
  };

  const showThumbnail = density !== 'compact';

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      onClick={onCardClick}
      className={cn(
        'group relative rounded-md border bg-[var(--bg-raised)] overflow-hidden transition-colors',
        'hover:border-[var(--line)]',
        isBeingDragged && 'opacity-30',
        isSelected && 'bg-[var(--bg-selected)]'
      )}
    >
      {/* Drag handle — top-left, only this triggers drag */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag card"
        className={cn(
          'absolute top-1.5 left-1.5 z-10 p-1 rounded text-[var(--fg-dim)] touch-none',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]',
          'cursor-grab active:cursor-grabbing'
        )}
        tabIndex={-1}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      {showThumbnail && (
        <div className="aspect-video w-full bg-[var(--bg-raised)] overflow-hidden">
          <ThumbnailPreview slug={video.slug} />
        </div>
      )}
      <div className={cn(showThumbnail ? 'p-3' : 'p-2.5')}>
        <div className={cn('font-medium line-clamp-2 mb-2', density === 'compact' ? 'text-[13px]' : 'text-sm')}>
          {video.frontmatter.title || video.slug}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {video.frontmatter.target_date && (
            <span className="text-xs text-[var(--fg-dim)] tabular-nums">
              {fmt(video.frontmatter.target_date)}
            </span>
          )}
          {video.frontmatter.category && density !== 'compact' && (
            <Badge className="text-[10px] px-1.5 py-0">{video.frontmatter.category}</Badge>
          )}
          {video.frontmatter.audience && density !== 'compact' && (
            <Badge className="text-[10px] px-1.5 py-0">
              {video.frontmatter.audience}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
