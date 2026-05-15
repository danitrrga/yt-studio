'use client';

import * as Popover from '@radix-ui/react-popover';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type ChipKind =
  | { kind: 'text'; placeholder?: string }
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'select'; options: { value: string; label: string }[] };

export function PropChip({
  label,
  value,
  display,
  emptyLabel,
  config,
  onSave,
  className,
}: {
  label: string;
  value: string | number | null;
  display: string;
  emptyLabel: string;
  config: ChipKind;
  onSave: (next: string | number | null) => void | Promise<void>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>(value == null ? '' : String(value));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(value == null ? '' : String(value));
  }, [value]);

  const isSet = value != null && value !== '';

  const commit = async (raw: string) => {
    setBusy(true);
    try {
      let next: string | number | null;
      if (!raw.trim()) {
        next = null;
      } else if (config.kind === 'number') {
        const n = parseInt(raw, 10);
        next = Number.isFinite(n) ? n : null;
      } else {
        next = raw.trim();
      }
      await onSave(next);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if ((e.metaKey || e.ctrlKey) && isSet) {
      e.preventDefault();
      commit('');
      return;
    }
    setOpen((o) => !o);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 h-6 text-xs transition-colors border',
            isSet
              ? 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]'
              : 'border-dashed border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]',
            className
          )}
          title={
            isSet
              ? `${label}: ${display} (click to edit · ⌘-click to clear)`
              : emptyLabel
          }
        >
          {isSet ? display : emptyLabel}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="z-[60] w-[220px] rounded-lg border bg-[var(--color-surface-elevated)] p-3 space-y-3"
        >
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-fg-muted)]">
            {label}
          </div>
          {config.kind === 'select' ? (
            <div className="flex flex-col gap-1">
              {config.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={busy}
                  onClick={() => commit(opt.value)}
                  className={cn(
                    'w-full text-left px-2 h-7 rounded text-sm transition-colors',
                    draft === opt.value
                      ? 'bg-[var(--fg)] text-[var(--fg-inverse)]'
                      : 'hover:bg-[var(--color-surface-hover)]'
                  )}
                >
                  {opt.label}
                </button>
              ))}
              {isSet && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => commit('')}
                  className="w-full text-left px-2 h-7 rounded text-sm text-[var(--color-fg-muted)] hover:text-[hsl(var(--color-overdue))] hover:bg-[var(--color-surface-hover)]"
                >
                  Clear
                </button>
              )}
            </div>
          ) : (
            <>
              <input
                autoFocus
                type={config.kind === 'number' ? 'number' : 'text'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit(draft);
                  if (e.key === 'Escape') setOpen(false);
                }}
                placeholder={config.kind === 'text' ? config.placeholder : undefined}
                {...(config.kind === 'number' && {
                  min: config.min,
                  max: config.max,
                })}
                className="w-full h-9 px-2 rounded-md border bg-[var(--color-surface)] text-sm outline-none"
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={busy || !isSet}
                  onClick={() => commit('')}
                  className="text-xs text-[var(--color-fg-muted)] hover:text-[hsl(var(--color-overdue))] disabled:opacity-40"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => commit(draft)}
                  className="px-2.5 h-7 rounded text-xs font-medium bg-[var(--color-button-primary)] text-[var(--color-button-primary-fg)] hover:bg-[var(--color-button-primary-hover)] disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
