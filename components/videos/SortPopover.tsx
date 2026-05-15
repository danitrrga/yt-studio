'use client';

import { useEffect, useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical, Plus, X } from 'lucide-react';
import { FIELDS, FIELD_ORDER } from '@/lib/fields';
import type { FieldId, SortRule } from '@/lib/filter-types';
import { newId } from '@/lib/filter-types';
import { useActiveView, usePendingOpen, viewStore } from '@/hooks/use-view-store';
import { cn } from '@/lib/utils';

export function SortPill() {
  const [open, setOpen] = useState(false);
  const view = useActiveView();
  const count = view.sort.length;
  const pending = usePendingOpen('sort');

  useEffect(() => {
    if (pending > 0) {
      setOpen(true);
      viewStore.clearPendingOpen();
    }
  }, [pending]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1.5 h-7 px-2 rounded-md border text-xs',
            count > 0
              ? 'bg-[var(--color-surface)] text-[var(--color-fg)] border-[var(--color-border)]'
              : 'border-dashed border-[var(--color-border)] text-[var(--color-fg-secondary)] hover:bg-[var(--color-surface-hover)]'
          )}
        >
          <ArrowUpDown className="w-3 h-3" />
          <span>Sort{count > 0 ? ` · ${count}` : ''}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="end"
          className="z-50 w-[320px] rounded-md border bg-[var(--color-surface-elevated)] overflow-hidden"
        >
          <SortPanel rules={view.sort} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SortPanel({ rules }: { rules: SortRule[] }) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
  const ids = useMemo(() => rules.map((r) => r.id), [rules]);

  function handleDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    viewStore.setSort(arrayMove(rules, from, to));
  }

  return (
    <div>
      <div className="p-2 text-xs text-[var(--color-fg-muted)] border-b border-[var(--color-border-subtle)]">
        Sort rules · drag to reorder
      </div>

      {rules.length === 0 ? (
        <div className="px-3 py-6 text-center text-xs text-[var(--color-fg-muted)]">No sort rules</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="p-1">
              {rules.map((r) => <SortRuleRow key={r.id} rule={r} />)}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="p-1 border-t border-[var(--color-border-subtle)]">
        <AddSortButton existing={rules.map((r) => r.field)} />
      </div>
    </div>
  );
}

function SortRuleRow({ rule }: { rule: SortRule }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rule.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const meta = FIELDS[rule.field];
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1 px-1 py-1 rounded hover:bg-[var(--color-surface-hover)]"
    >
      <button {...attributes} {...listeners} className="p-0.5 cursor-grab active:cursor-grabbing text-[var(--color-fg-muted)]">
        <GripVertical className="w-3 h-3" />
      </button>
      <span className="flex-1 text-sm">{meta.label}</span>
      <button
        onClick={() => viewStore.setSort(
          toggleDirection(rule)
        )}
        className="p-1 rounded hover:bg-[var(--color-surface-hover)]"
        aria-label="Toggle direction"
      >
        {rule.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      </button>
      <button
        onClick={() => viewStore.removeSort(rule.id)}
        className="p-1 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        aria-label="Remove sort"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function toggleDirection(rule: SortRule): SortRule[] {
  const s = viewStore.getState().views[viewStore.getState().activeView].sort;
  return s.map((r) => r.id === rule.id ? { ...r, direction: r.direction === 'asc' ? 'desc' : 'asc' } : r);
}

function AddSortButton({ existing }: { existing: FieldId[] }) {
  const [open, setOpen] = useState(false);
  const options = FIELD_ORDER.filter((id) => !existing.includes(id));
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-[var(--color-fg-secondary)] hover:bg-[var(--color-surface-hover)]">
          <Plus className="w-3 h-3" />
          <span>Add sort</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="z-50 w-[220px] max-h-[320px] overflow-y-auto rounded-md border bg-[var(--color-surface-elevated)] p-1"
        >
          {options.map((id) => (
            <button
              key={id}
              onClick={() => {
                viewStore.addSort({ id: newId(), field: id, direction: 'asc' });
                setOpen(false);
              }}
              className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-[var(--color-surface-hover)]"
            >
              {FIELDS[id].label}
            </button>
          ))}
          {options.length === 0 && (
            <div className="px-2 py-4 text-center text-xs text-[var(--color-fg-muted)]">All fields added</div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
