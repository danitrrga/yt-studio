'use client';

import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Plus, Search } from 'lucide-react';
import { useVideos } from '@/hooks/use-videos';
import { STATUS_COLOR_VAR, STATUS_LABELS } from '@/lib/status';
import { cn } from '@/lib/utils';

export function LinkVideoPopover({
  alreadyLinked,
  onPick,
}: {
  alreadyLinked: string[];
  onPick: (videoSlug: string) => void;
}) {
  const { videos } = useVideos();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const linked = useMemo(() => new Set(alreadyLinked), [alreadyLinked]);

  const filtered = useMemo(() => {
    const list = videos ?? [];
    const q = query.trim().toLowerCase();
    return list
      .filter((v) => !linked.has(v.slug))
      .filter((v) => {
        if (!q) return true;
        return (
          v.frontmatter.title.toLowerCase().includes(q) ||
          v.slug.toLowerCase().includes(q)
        );
      })
      .slice(0, 50);
  }, [videos, linked, query]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md border text-xs hover:bg-[var(--color-surface-hover)]">
          <Plus className="w-3.5 h-3.5" />
          Link a video
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-80 rounded-lg border bg-[var(--color-surface-elevated)] overflow-hidden"
        >
          <div className="flex items-center gap-2 px-2.5 h-9 border-b">
            <Search className="w-3.5 h-3.5 text-[var(--color-fg-muted)]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search videos…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--color-fg-muted)]"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-[var(--color-fg-muted)]">
                {videos?.length ? 'No videos match' : 'No videos yet'}
              </div>
            ) : (
              filtered.map((v) => (
                <button
                  key={v.slug}
                  onClick={() => {
                    onPick(v.slug);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--color-surface-hover)]"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: `hsl(var(${STATUS_COLOR_VAR[v.frontmatter.status]}))`,
                    }}
                  />
                  <span className="text-sm flex-1 truncate">
                    {v.frontmatter.title || v.slug}
                  </span>
                  <span
                    className={cn(
                      'font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--color-fg-muted)]'
                    )}
                  >
                    {STATUS_LABELS[v.frontmatter.status]}
                  </span>
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
