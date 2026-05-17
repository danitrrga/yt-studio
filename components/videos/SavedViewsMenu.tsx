'use client';

import * as Popover from '@radix-ui/react-popover';
import {
  Bookmark,
  Plus,
  Trash2,
  Sparkles,
  Table as TableIcon,
  Columns3,
  Calendar as CalendarIcon,
  ImageIcon,
  Activity,
} from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useActiveView, useActiveViewMode, viewStore } from '@/hooks/use-view-store';
import { useSavedViews, addSavedView, removeSavedView } from '@/hooks/use-saved-views';
import { newSavedViewId, BUILTIN_VIEWS, type SavedView } from '@/lib/saved-views';
import type { ViewMode } from '@/lib/filter-types';
import { cn } from '@/lib/utils';

const MODE_ICON: Record<ViewMode, typeof TableIcon> = {
  table: TableIcon,
  kanban: Columns3,
  calendar: CalendarIcon,
  timeline: Activity,
  gallery: ImageIcon,
};

export function SavedViewsMenu() {
  const view = useActiveView();
  const mode = useActiveViewMode();
  const saved = useSavedViews();
  const [name, setName] = useState('');
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    addSavedView({
      id: newSavedViewId(),
      name: trimmed,
      mode,
      state: view,
      groupBy: view.groupBy,
      createdAt: Date.now(),
    });
    setName('');
    toast.success(`Saved "${trimmed}"`);
  };

  const apply = (v: SavedView) => {
    if (v.mode !== mode) viewStore.setActiveView(v.mode);
    viewStore.setActiveViewState(v.state);
    setOpen(false);
    router.replace('/videos');
    toast.success(`Switched to "${v.name}"`);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          title="Views"
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]"
        >
          <Bookmark className="w-3 h-3" />
          Views
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="end"
          className="z-[60] w-[300px] rounded-md border bg-[var(--bg-raised)] overflow-hidden"
        >
          <div className="px-3 pt-3 pb-2">
            <div className="text-[13px] font-medium text-[var(--fg)]">Views</div>
            <div className="text-[11px] text-[var(--fg-dim)] mt-0.5">
              one click to slice your pipeline
            </div>
          </div>

          <div className="px-2 pb-2 max-h-[60vh] overflow-y-auto">
            <SectionHeader icon={Sparkles} label="Presets" />
            <ul className="space-y-0.5">
              {BUILTIN_VIEWS.map((v) => (
                <ViewRow key={v.id} view={v} onApply={() => apply(v)} />
              ))}
            </ul>

            {saved.length > 0 && (
              <>
                <SectionHeader icon={Bookmark} label="Yours" className="mt-3" />
                <ul className="space-y-0.5">
                  {saved.map((v) => (
                    <ViewRow
                      key={v.id}
                      view={v}
                      onApply={() => apply(v)}
                      onDelete={() => {
                        if (confirm(`Delete "${v.name}"?`)) removeSavedView(v.id);
                      }}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="border-t px-3 py-2.5 bg-[var(--bg-raised)]">
            <div className="font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)] mb-1.5">
              Save current as…
            </div>
            <div className="flex gap-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save();
                }}
                placeholder="Name…"
                className="flex-1 h-7 px-2 rounded-md border bg-[var(--bg-raised)] text-xs outline-none"
              />
              <button
                onClick={save}
                disabled={!name.trim()}
                className={cn(
                  'inline-flex items-center justify-center w-7 h-7 rounded-md text-xs',
                  name.trim()
                    ? 'bg-[var(--fg)] text-[var(--fg-inverse)] hover:bg-[var(--fg)]'
                    : 'bg-[var(--bg-raised)] text-[var(--fg-dim)] cursor-not-allowed'
                )}
                title="Save"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SectionHeader({
  icon: Icon,
  label,
  className,
}: {
  icon: typeof Sparkles;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'px-2 pt-1.5 pb-1 flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)]',
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </div>
  );
}

function ViewRow({
  view,
  onApply,
  onDelete,
}: {
  view: SavedView;
  onApply: () => void;
  onDelete?: () => void;
}) {
  const Icon = MODE_ICON[view.mode];
  return (
    <li className="group flex items-stretch rounded hover:bg-[var(--bg-hover)]">
      <button
        onClick={onApply}
        className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 text-left"
      >
        <Icon className="w-3.5 h-3.5 text-[var(--fg-dim)] shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-[var(--fg)] leading-tight truncate">
            {view.name}
          </div>
          {view.description && (
            <div className="text-[11px] text-[var(--fg-dim)] leading-tight truncate mt-0.5">
              {view.description}
            </div>
          )}
        </div>
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-dim)] shrink-0">
          {view.mode}
        </span>
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 px-2 text-[var(--fg-dim)] hover:text-[var(--fg)]"
          title="Delete"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </li>
  );
}
