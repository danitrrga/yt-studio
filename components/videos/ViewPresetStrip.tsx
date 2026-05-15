'use client';

import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Table as TableIcon,
  Columns3,
  Calendar as CalendarIcon,
  ImageIcon,
  Activity,
} from 'lucide-react';
import { useActiveViewMode, viewStore } from '@/hooks/use-view-store';
import { BUILTIN_VIEWS, type SavedView } from '@/lib/saved-views';
import { useSavedViews } from '@/hooks/use-saved-views';
import type { ViewMode } from '@/lib/filter-types';
import { cn } from '@/lib/utils';

const MODE_ICON: Record<ViewMode, typeof TableIcon> = {
  table: TableIcon,
  kanban: Columns3,
  calendar: CalendarIcon,
  timeline: Activity,
  gallery: ImageIcon,
};

/**
 * Horizontal pill row with the 5 built-in presets + the user's saved views.
 * One click swaps the entire view state. Always visible above the filter bar
 * so a new user has somewhere obvious to start without learning the menu.
 */
export function ViewPresetStrip() {
  const router = useRouter();
  const mode = useActiveViewMode();
  const saved = useSavedViews();

  const apply = (v: SavedView) => {
    if (v.mode !== mode) viewStore.setActiveView(v.mode);
    viewStore.setActiveViewState(v.state);
    router.replace('/videos');
  };

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5 scrollbar-thin">
      <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] mr-1 shrink-0">
        <Sparkles className="w-3 h-3" />
        Quick views
      </span>
      {BUILTIN_VIEWS.map((v) => (
        <PresetPill key={v.id} view={v} onClick={() => apply(v)} />
      ))}
      {saved.length > 0 && (
        <>
          <span className="h-4 w-px bg-[var(--color-border-subtle)] mx-1 shrink-0" />
          {saved.map((v) => (
            <PresetPill key={v.id} view={v} onClick={() => apply(v)} muted />
          ))}
        </>
      )}
    </div>
  );
}

function PresetPill({
  view,
  onClick,
  muted,
}: {
  view: SavedView;
  onClick: () => void;
  muted?: boolean;
}) {
  const Icon = MODE_ICON[view.mode];
  return (
    <button
      type="button"
      onClick={onClick}
      title={view.description ?? ''}
      className={cn(
        'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs whitespace-nowrap shrink-0',
        'transition-colors',
        muted
          ? 'text-[var(--color-fg-secondary)] hover:bg-[var(--color-surface-hover)]'
          : 'text-[var(--color-fg)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]'
      )}
    >
      <Icon className="w-3 h-3 text-[var(--color-fg-muted)]" />
      {view.name}
    </button>
  );
}
