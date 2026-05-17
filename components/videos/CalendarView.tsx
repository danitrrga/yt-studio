'use client';

import { useMemo, useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  addWeeks,
  parseISO,
} from 'date-fns';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import * as Popover from '@radix-ui/react-popover';
import { ChevronLeft, ChevronRight, Target, Video as VideoIcon, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { VideoSummary } from '@/lib/types';
import type { CalendarDateType, CalendarMode, Density } from '@/lib/filter-types';
import { useActiveView, viewStore } from '@/hooks/use-view-store';
import { useUI } from '@/components/UIProvider';
import { useSWRConfig } from 'swr';
import { updateVideoField } from '@/hooks/use-videos';
import {
  flattenEvents,
  groupEventsByDay,
  fieldForKind,
  KIND_LABEL,
  KIND_HEX,
  type CalendarEvent,
  type CalendarEventKind,
} from '@/lib/calendar-events';
import { cn } from '@/lib/utils';

const DEFAULT_TYPES: CalendarDateType[] = ['target_date'];

const KIND_ICON: Record<CalendarEventKind, typeof Target> = {
  target: Target,
  record: VideoIcon,
  published: CheckCircle2,
};

// Local-day key. Frontmatter dates are calendar-day strings (YYYY-MM-DD,
// timezone-naive). `toISOString()` would shift to UTC and skew the calendar
// by ±1 day in any non-UTC zone — making a video planned for Apr 30 appear
// on May 1 in Europe/Amsterdam, etc.
function isoDay(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function CalendarView({
  videos,
  onCardClick,
}: {
  videos: VideoSummary[];
  onCardClick: (slug: string) => void;
}) {
  const view = useActiveView();
  const enabled = view.calendarDateTypes ?? DEFAULT_TYPES;
  const mode: CalendarMode = view.calendarMode ?? 'month';
  const density: Density = view.density ?? 'regular';
  const { openQuickAdd } = useUI();
  const { mutate: globalMutate } = useSWRConfig();
  const [anchor, setAnchor] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);

  const { start, end, label } = useMemo(() => {
    if (mode === 'week') {
      const s = startOfWeek(anchor, { weekStartsOn: 1 });
      const e = endOfWeek(anchor, { weekStartsOn: 1 });
      return {
        start: s,
        end: e,
        label: `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`,
      };
    }
    const monthStart = startOfMonth(anchor);
    return {
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
      label: format(anchor, 'MMMM yyyy'),
    };
  }, [anchor, mode]);

  const days = useMemo(() => eachDayOfInterval({ start, end }), [start, end]);

  const events = useMemo(() => flattenEvents(videos, enabled), [videos, enabled]);
  const eventsByDay = useMemo(() => groupEventsByDay(events), [events]);
  const activeEvent = useMemo(
    () => (activeId ? events.find((e) => e.id === activeId) ?? null : null),
    [activeId, events]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id as string | undefined;
    if (!overId || !overId.startsWith('day-')) return;
    const targetDate = overId.slice(4);
    const eventId = e.active.id as string;
    const ev = events.find((x) => x.id === eventId);
    if (!ev) return;
    if (ev.date === targetDate) return;

    const field = fieldForKind(ev.kind);
    const prevDate = ev.date;
    const title = ev.video.frontmatter.title || ev.slug;
    // Optimistic patch — SWR cache reflects the new date instantly, so the
    // chip moves to the dropped cell without waiting for SSE/refetch.
    globalMutate(
      '/api/videos',
      (current?: VideoSummary[]) =>
        (current ?? []).map((v) =>
          v.slug === ev.slug
            ? { ...v, frontmatter: { ...v.frontmatter, [field]: targetDate } }
            : v
        ),
      { revalidate: false }
    );
    try {
      await updateVideoField(ev.slug, { [field]: targetDate });
      toast.success(`${title} · ${KIND_LABEL[ev.kind]} → ${format(parseISO(targetDate), 'MMM d')}`, {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              globalMutate(
                '/api/videos',
                (current?: VideoSummary[]) =>
                  (current ?? []).map((v) =>
                    v.slug === ev.slug
                      ? { ...v, frontmatter: { ...v.frontmatter, [field]: prevDate } }
                      : v
                  ),
                { revalidate: false }
              );
              await updateVideoField(ev.slug, { [field]: prevDate });
              globalMutate('/api/videos');
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Undo failed');
            }
          },
        },
      });
      // Background revalidate in case the optimistic patch missed any
      // server-side normalization (mtime, etc.)
      globalMutate('/api/videos');
    } catch (err) {
      // Rollback on failure
      globalMutate('/api/videos');
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const goPrev = () => setAnchor(mode === 'week' ? addWeeks(anchor, -1) : addMonths(anchor, -1));
  const goNext = () => setAnchor(mode === 'week' ? addWeeks(anchor, 1) : addMonths(anchor, 1));

  const dayClick = (day: Date) => {
    openQuickAdd({ targetDate: isoDay(day) });
  };

  const collisionDetection = pointerWithin;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="rounded-md border bg-[var(--bg-raised)] overflow-hidden">
        <Header
          label={label}
          mode={mode}
          enabled={enabled}
          onPrev={goPrev}
          onNext={goNext}
          onToday={() => setAnchor(new Date())}
          onMode={(m) => viewStore.setCalendarMode(m)}
          onToggleType={(t) => {
            const next = enabled.includes(t)
              ? enabled.filter((x) => x !== t)
              : [...enabled, t];
            viewStore.setCalendarDateTypes(next);
          }}
        />

        <div className="grid grid-cols-7 border-b bg-[var(--bg-raised)]">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div
              key={d}
              className="px-2 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--fg-dim)]"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => (
            <DayCell
              key={day.toISOString()}
              day={day}
              inMonth={mode === 'week' ? true : isSameMonth(day, anchor)}
              today={isToday(day)}
              events={eventsByDay.get(isoDay(day)) ?? []}
              density={density}
              mode={mode}
              activeId={activeId}
              onCardClick={onCardClick}
              onDayClick={() => dayClick(day)}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeEvent && <ChipGhost event={activeEvent} />}
      </DragOverlay>
    </DndContext>
  );
}

function Header({
  label,
  mode,
  enabled,
  onPrev,
  onNext,
  onToday,
  onMode,
  onToggleType,
}: {
  label: string;
  mode: CalendarMode;
  enabled: CalendarDateType[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onMode: (m: CalendarMode) => void;
  onToggleType: (t: CalendarDateType) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b">
      <div className="flex items-center gap-2">
        <h3 className="font-bold tabular-nums">{label}</h3>
      </div>
      <div className="flex items-center gap-2">
        <TypeToggles enabled={enabled} onToggle={onToggleType} />
        <div className="inline-flex items-center rounded-md border overflow-hidden text-xs">
          {(['month', 'week'] as CalendarMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onMode(m)}
              className={cn(
                'px-2.5 h-7 transition-colors',
                m === mode
                  ? 'bg-[var(--fg)] text-[var(--fg-inverse)]'
                  : 'text-[var(--fg-dim)] hover:bg-[var(--bg-hover)]'
              )}
            >
              {m === 'month' ? 'Month' : 'Week'}
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
    </div>
  );
}

function TypeToggles({
  enabled,
  onToggle,
}: {
  enabled: CalendarDateType[];
  onToggle: (t: CalendarDateType) => void;
}) {
  const items: { type: CalendarDateType; label: string; kind: CalendarEventKind }[] = [
    { type: 'target_date', label: 'Plan', kind: 'target' },
    { type: 'record_date', label: 'Record', kind: 'record' },
    { type: 'published_date', label: 'Published', kind: 'published' },
  ];
  return (
    <div className="inline-flex items-center gap-1">
      {items.map(({ type, label, kind }) => {
        const on = enabled.includes(type);
        const Icon = KIND_ICON[kind];
        return (
          <button
            key={type}
            onClick={() => onToggle(type)}
            className={cn(
              'inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs border',
              on
                ? 'text-[var(--fg)]'
                : 'text-[var(--fg-dim)] border-transparent hover:bg-[var(--bg-hover)]'
            )}
            style={
              on
                ? {
                    backgroundColor: `color-mix(in srgb, ${KIND_HEX[kind]} 12%, transparent)`,
                    borderColor: `color-mix(in srgb, ${KIND_HEX[kind]} 40%, transparent)`,
                  }
                : undefined
            }
          >
            <Icon className="w-3 h-3" style={on ? { color: KIND_HEX[kind] } : undefined} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function DayCell({
  day,
  inMonth,
  today,
  events,
  density,
  mode,
  activeId,
  onCardClick,
  onDayClick,
}: {
  day: Date;
  inMonth: boolean;
  today: boolean;
  events: CalendarEvent[];
  density: Density;
  mode: CalendarMode;
  activeId: string | null;
  onCardClick: (slug: string) => void;
  onDayClick: () => void;
}) {
  const id = `day-${isoDay(day)}`;
  const { setNodeRef, isOver } = useDroppable({ id });

  const minH = mode === 'week' ? 'min-h-[420px]' : 'min-h-[110px]';

  const limit =
    density === 'compact' ? 5 : density === 'comfortable' ? 2 : 3;
  const visible = events.slice(0, limit);
  const overflow = events.length - visible.length;

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        // Only fire when click is the cell itself (not a chip)
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.cellbg === '1') {
          onDayClick();
        }
      }}
      className={cn(
        'relative border-r border-b border-[var(--line-faint)] p-1.5 cursor-pointer',
        minH,
        !inMonth && 'bg-[var(--bg)] opacity-40',
        isOver && 'bg-[var(--bg-hover)]'
      )}
    >
      <div data-cellbg="1" className="absolute inset-0 pointer-events-none" />
      <div
        className={cn(
          'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs mb-1 tabular-nums relative z-10',
          today
            ? 'bg-[var(--fg)] text-[var(--fg-inverse)] font-medium'
            : inMonth
            ? 'text-[var(--fg-muted)]'
            : 'text-[var(--fg-dim)]'
        )}
      >
        {format(day, 'd')}
      </div>
      <div className="space-y-1 relative z-10">
        {visible.map((ev) => (
          <CalendarChip
            key={ev.id}
            event={ev}
            density={density}
            isBeingDragged={activeId === ev.id}
            onClick={() => onCardClick(ev.slug)}
          />
        ))}
        {overflow > 0 && (
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="w-full text-[10px] text-[var(--fg-dim)] text-left px-1.5 py-0.5 rounded hover:bg-[var(--bg-hover)]"
              >
                + {overflow} more
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                sideOffset={6}
                align="start"
                className="z-[60] w-[260px] rounded-md border bg-[var(--bg-raised)] p-2 space-y-1"
              >
                <div className="font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)] px-2 pt-1">
                  {format(day, 'EEEE, MMM d')} · {events.length} events
                </div>
                {events.map((ev) => (
                  <CalendarChip
                    key={ev.id}
                    event={ev}
                    density="regular"
                    isBeingDragged={false}
                    onClick={() => onCardClick(ev.slug)}
                  />
                ))}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>
    </div>
  );
}

function CalendarChip({
  event,
  density,
  isBeingDragged,
  onClick,
}: {
  event: CalendarEvent;
  density: Density;
  isBeingDragged: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: event.id });
  const Icon = KIND_ICON[event.kind];
  const color = KIND_HEX[event.kind];
  const today = isoDay(new Date());
  const overdue =
    event.kind === 'target' &&
    event.date < today &&
    event.video.frontmatter.status !== 'published';

  if (density === 'compact') {
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
          'flex items-center gap-1 w-full text-left text-[10px] px-1 py-0.5 rounded',
          'hover:bg-[var(--bg-hover)] transition-colors',
          isBeingDragged && 'opacity-30'
        )}
        title={`${event.video.frontmatter.title} · ${KIND_LABEL[event.kind]}`}
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="truncate text-[var(--fg-muted)]">
          {event.video.frontmatter.title || event.slug}
        </span>
      </button>
    );
  }

  const isCard = density === 'comfortable';

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
        'flex items-center gap-1.5 w-full text-left rounded transition-colors border cursor-grab active:cursor-grabbing',
        isCard ? 'px-2 py-1' : 'px-1.5 py-0.5',
        isBeingDragged && 'opacity-30',
        overdue && 'ring-1 ring-[var(--red)]'
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
        color,
      }}
      title={`${event.video.frontmatter.title} · ${KIND_LABEL[event.kind]}`}
    >
      <Icon className={cn('shrink-0', isCard ? 'w-3 h-3' : 'w-2.5 h-2.5')} />
      <span className={cn('truncate flex-1', isCard ? 'text-xs' : 'text-[10px]')}>
        {event.video.frontmatter.title || event.slug}
      </span>
    </button>
  );
}

function ChipGhost({ event }: { event: CalendarEvent }) {
  const Icon = KIND_ICON[event.kind];
  const color = KIND_HEX[event.kind];
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs ring-1"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 50%, transparent)`,
        color,
      }}
    >
      <Icon className="w-3 h-3" />
      <span className="truncate max-w-[200px]">{event.video.frontmatter.title || event.slug}</span>
    </div>
  );
}
