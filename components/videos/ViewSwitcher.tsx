'use client';

import { Table2, LayoutGrid, Calendar, Focus, GanttChart, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUI } from '@/components/UIProvider';
import { Tooltip } from '@/components/ui/Tooltip';

export type ViewMode = 'table' | 'kanban' | 'calendar' | 'timeline' | 'gallery';

const VIEWS: { id: ViewMode; label: string; icon: React.ElementType }[] = [
  { id: 'table', label: 'Table', icon: Table2 },
  { id: 'kanban', label: 'Kanban', icon: LayoutGrid },
  { id: 'gallery', label: 'Gallery', icon: ImageIcon },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'timeline', label: 'Timeline', icon: GanttChart },
];

export function ViewSwitcher({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const { focus, toggleFocus } = useUI();
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center p-0.5 rounded-md border bg-[var(--bg-raised)]">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              value === id
                ? 'bg-[var(--fg)] text-[var(--fg-inverse)]'
                : 'text-[var(--fg-dim)] hover:text-[var(--fg)] hover:bg-[var(--bg-hover)]'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>
      <Tooltip content={focus ? 'Exit focus · Esc' : 'Focus · F'} side="bottom">
        <button
          onClick={toggleFocus}
          className={cn(
            'inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors',
            focus
              ? 'bg-[var(--bg-selected)] border-[var(--line-strong)] text-[var(--fg)]'
              : 'bg-[var(--bg-raised)] text-[var(--fg-dim)] hover:text-[var(--fg)]'
          )}
        >
          <Focus className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
    </div>
  );
}
