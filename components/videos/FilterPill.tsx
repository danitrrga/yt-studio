'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { X } from 'lucide-react';
import { FIELDS, OP_LABELS } from '@/lib/fields';
import type { Condition } from '@/lib/filter-types';
import { viewStore } from '@/hooks/use-view-store';
import { FilterPopover } from './FilterPopover';
import type { VideoSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

export function FilterPill({
  condition,
  videos,
  autoOpen,
}: {
  condition: Condition;
  videos: VideoSummary[];
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!autoOpen);
  const meta = FIELDS[condition.field];
  const valueLabel = formatValue(condition, meta.optionLabel);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className="inline-flex items-center h-7 rounded-md border bg-[var(--color-surface)] text-xs">
        <Popover.Trigger asChild>
          <button className="flex items-center gap-1.5 px-2 h-full hover:bg-[var(--color-surface-hover)] rounded-l-md outline-none">
            <span className="font-medium text-[var(--color-fg)]">{meta.label}</span>
            <span className="text-[var(--color-fg-muted)]">{OP_LABELS[condition.op]}</span>
            {valueLabel && <span className="text-[var(--fg)] truncate max-w-[200px]">{valueLabel}</span>}
          </button>
        </Popover.Trigger>
        <button
          onClick={() => viewStore.removeCondition(condition.id)}
          className="flex items-center justify-center w-6 h-full border-l border-[var(--color-border-subtle)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)] rounded-r-md"
          aria-label="Remove filter"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className={cn(
            'z-50 w-[260px] rounded-md border bg-[var(--color-surface-elevated)] overflow-hidden'
          )}
        >
          <FilterPopover
            initial={condition}
            videos={videos}
            onCommit={(patch) => {
              viewStore.updateCondition(condition.id, patch);
            }}
            onCancel={() => setOpen(false)}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function formatValue(c: Condition, labelFor?: (v: string) => string): string | null {
  if (c.op === 'is_empty' || c.op === 'is_not_empty' || c.op === 'is_checked' || c.op === 'is_not_checked') return null;
  const v = c.value;
  if (v == null) return '…';
  if (Array.isArray(v)) {
    if (v.length === 0) return '…';
    const labels = (v as string[]).map((x) => labelFor?.(x) ?? x);
    if (labels.length <= 2) return labels.join(', ');
    return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
  }
  const s = String(v);
  return labelFor ? labelFor(s) : s;
}
