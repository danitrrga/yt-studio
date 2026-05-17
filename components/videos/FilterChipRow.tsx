'use client';

import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Plus, X } from 'lucide-react';
import { viewStore, useActiveView, usePendingOpen } from '@/hooks/use-view-store';
import { newId, type Condition } from '@/lib/filter-types';
import { defaultOpForField, opNeedsValue } from '@/lib/fields';
import { FilterPill } from './FilterPill';
import { FilterPopover } from './FilterPopover';
import type { VideoSummary } from '@/lib/types';

export function FilterChipRow({ videos }: { videos: VideoSummary[] }) {
  const view = useActiveView();
  const [addOpen, setAddOpen] = useState(false);
  const [newCondId, setNewCondId] = useState<string | null>(null);
  const pending = usePendingOpen('filter');

  useEffect(() => {
    if (pending > 0) {
      setAddOpen(true);
      viewStore.clearPendingOpen();
    }
  }, [pending]);

  const conds = view.filter.children.filter((c) => c.kind === 'cond') as Condition[];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {conds.map((c) => (
        <FilterPill
          key={c.id}
          condition={c}
          videos={videos}
          autoOpen={c.id === newCondId}
        />
      ))}

      <Popover.Root
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setNewCondId(null);
        }}
      >
        <Popover.Trigger asChild>
          <button className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-dashed border-[var(--line)] text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-hover)]">
            <Plus className="w-3 h-3" />
            <span>Filter</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={6}
            align="start"
            className="z-50 w-[260px] rounded-md border bg-[var(--bg-raised)] overflow-hidden"
          >
            <FilterPopover
              videos={videos}
              onCommit={(patch) => {
                const op = patch.op ?? defaultOpForField(patch.field);
                const id = newId();
                const cond: Condition = {
                  kind: 'cond',
                  id,
                  field: patch.field,
                  op,
                  value: patch.value,
                };
                viewStore.addCondition(cond);
                if (opNeedsValue(op)) setNewCondId(id);
                setAddOpen(false);
              }}
              onCancel={() => setAddOpen(false)}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {conds.length > 0 && (
        <button
          onClick={() => viewStore.clearFilters()}
          className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs text-[var(--fg-dim)] hover:text-[var(--fg)]"
        >
          <X className="w-3 h-3" />
          <span>Clear</span>
        </button>
      )}
    </div>
  );
}
