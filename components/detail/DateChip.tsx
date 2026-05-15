'use client';

import * as Popover from '@radix-ui/react-popover';
import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
}

function isoDaysFromToday(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

export function DateChip({
  label,
  icon: Icon,
  date,
  onChange,
  overdue = false,
  openSignal = 0,
}: {
  label: string;
  icon: LucideIcon;
  date: string | null;
  onChange: (next: string | null) => void | Promise<void>;
  overdue?: boolean;
  /** Increment to programmatically open the popover (for keyboard shortcuts). */
  openSignal?: number;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(date ?? '');
  const [busy, setBusy] = useState(false);

  // React to external open triggers
  useEffect(() => {
    if (openSignal > 0) {
      setDraft(date ?? '');
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  const save = async (value: string | null) => {
    setBusy(true);
    try {
      await onChange(value);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    if ((e.metaKey || e.ctrlKey) && date) {
      e.preventDefault();
      save(null);
      return;
    }
    setDraft(date ?? '');
    setOpen((o) => !o);
  };

  const isSet = !!date;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={handleTriggerClick}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 h-7 text-xs transition-colors',
            'border',
            isSet
              ? overdue
                ? 'border-[hsl(var(--color-overdue))] bg-[hsl(var(--color-overdue)/0.08)] text-[hsl(var(--color-overdue))]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]'
              : 'border-dashed border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]'
          )}
          title={
            isSet
              ? `${label}: ${fmtDate(date)} (click to edit · ⌘-click to clear)`
              : `Set ${label.toLowerCase()}`
          }
        >
          <Icon className="w-3 h-3 shrink-0" strokeWidth={1.75} />
          <span className="tabular-nums">{isSet ? fmtDate(date) : label}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="z-[60] w-[240px] rounded-lg border bg-[var(--color-surface-elevated)] p-3 space-y-3"
        >
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
            {label}
          </div>
          <input
            type="date"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save(draft || null);
              if (e.key === 'Escape') setOpen(false);
            }}
            className="w-full h-9 px-2 rounded-md border bg-[var(--color-surface)] text-sm outline-none"
          />
          <div className="flex gap-1 text-[11px]">
            <QuickBtn onClick={() => setDraft(isoDaysFromToday(0))}>Today</QuickBtn>
            <QuickBtn onClick={() => setDraft(isoDaysFromToday(1))}>Tomorrow</QuickBtn>
            <QuickBtn onClick={() => setDraft(isoDaysFromToday(7))}>+1w</QuickBtn>
          </div>
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              disabled={busy || !isSet}
              onClick={() => save(null)}
              className="text-xs text-[var(--color-fg-muted)] hover:text-[hsl(var(--color-overdue))] disabled:opacity-40"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => save(draft || null)}
              className="px-2.5 h-7 rounded text-xs font-medium bg-[var(--color-button-primary)] text-[var(--color-button-primary-fg)] hover:bg-[var(--color-button-primary-hover)] disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function QuickBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 h-6 rounded border text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]"
    >
      {children}
    </button>
  );
}
