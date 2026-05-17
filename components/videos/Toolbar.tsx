'use client';

import * as Popover from '@radix-ui/react-popover';
import { Download, Rows3, Rows4, AlignJustify, Layers, ChevronDown } from 'lucide-react';
import type { VideoSummary } from '@/lib/types';
import type { Density, GroupBy } from '@/lib/filter-types';
import { useActiveView, viewStore } from '@/hooks/use-view-store';
import { downloadCsv } from '@/lib/export-csv';
import { SavedViewsMenu } from './SavedViewsMenu';
import { cn } from '@/lib/utils';

export function Toolbar({
  filtered,
  mode,
}: {
  filtered: VideoSummary[];
  mode?: 'table' | 'kanban' | 'gallery';
}) {
  const view = useActiveView();
  const density: Density = view.density ?? 'regular';
  const groupBy: GroupBy = view.groupBy ?? 'none';
  const showGroup = mode === 'table' || mode === undefined;

  return (
    <div className="flex items-center gap-2 text-xs">
      {showGroup && <GroupByMenu value={groupBy} onChange={(g) => viewStore.setGroupBy(g)} />}
      <DensityToggle value={density} onChange={(d) => viewStore.setDensity(d)} />
      <SavedViewsMenu />
      <button
        type="button"
        onClick={() => downloadCsv(filtered)}
        title="Export filtered set as CSV"
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]"
      >
        <Download className="w-3 h-3" />
        CSV
      </button>
    </div>
  );
}

function DensityToggle({
  value,
  onChange,
}: {
  value: Density;
  onChange: (d: Density) => void;
}) {
  const options: { value: Density; icon: typeof Rows3; title: string }[] = [
    { value: 'compact', icon: Rows4, title: 'Compact' },
    { value: 'regular', icon: Rows3, title: 'Regular' },
    { value: 'comfortable', icon: AlignJustify, title: 'Comfortable' },
  ];
  return (
    <div className="inline-flex items-center rounded-md border overflow-hidden">
      {options.map((o) => {
        const Icon = o.icon;
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            title={o.title}
            className={cn(
              'inline-flex items-center justify-center w-7 h-7 transition-colors',
              active
                ? 'bg-[var(--fg)] text-[var(--fg-inverse)]'
                : 'text-[var(--fg-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
}

const GROUP_LABELS: Record<GroupBy, string> = {
  none: 'No group',
  status: 'Status',
  target_date: 'Plan date',
  record_date: 'Record date',
};

function GroupByMenu({ value, onChange }: { value: GroupBy; onChange: (g: GroupBy) => void }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          title="Group by"
          className={cn(
            'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border',
            value !== 'none'
              ? 'bg-[var(--bg-selected)] border-[var(--line-strong)] text-[var(--fg)]'
              : 'text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]'
          )}
        >
          <Layers className="w-3 h-3" />
          {value === 'none' ? 'Group' : `Group: ${GROUP_LABELS[value]}`}
          <ChevronDown className="w-3 h-3" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="z-[60] rounded-md border bg-[var(--bg-raised)] py-1 min-w-[160px]"
        >
          {(Object.keys(GROUP_LABELS) as GroupBy[]).map((g) => (
            <Popover.Close
              key={g}
              onClick={() => onChange(g)}
              className={cn(
                'w-full text-left px-3 h-8 text-sm hover:bg-[var(--bg-hover)]',
                value === g && 'text-[var(--fg)] font-medium'
              )}
            >
              {GROUP_LABELS[g]}
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
