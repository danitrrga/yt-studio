'use client';

import Link from 'next/link';
import { useEventSummary } from '@/hooks/use-telemetry';
import { cn } from '@/lib/utils';

type Tone = 'green' | 'amber' | 'red' | 'idle';

function toneFor(counters: { saveFails: number; conflicts: number; crashes: number }): Tone {
  if (counters.saveFails > 0 || counters.crashes > 0) return 'red';
  if (counters.conflicts > 0) return 'amber';
  return 'green';
}

const TONE_DOT: Record<Tone, string> = {
  green: 'bg-[hsl(var(--status-published))]',
  amber: 'bg-[var(--color-warning)]',
  red: 'bg-[var(--red-dim)]',
  idle: 'bg-[var(--fg-dim)]',
};

export function StatusPill({ collapsed }: { collapsed: boolean }) {
  const { summary, isLoading } = useEventSummary('24h');

  if (isLoading || !summary) {
    return (
      <Link
        href="/diagnostics"
        className={cn(
          'flex items-center gap-2 rounded-md text-xs text-[var(--fg-dim)] hover:bg-[var(--bg-hover)]',
          collapsed ? 'justify-center h-7 w-7' : 'px-2 py-1.5'
        )}
        title="Diagnostics"
      >
        <span className={cn('w-2 h-2 rounded-full', TONE_DOT.idle)} />
        {!collapsed && <span className="truncate">Loading…</span>}
      </Link>
    );
  }

  const tone = toneFor(summary.counters);
  const label =
    tone === 'red'
      ? `${summary.counters.saveFails + summary.counters.crashes} fail${
          summary.counters.saveFails + summary.counters.crashes === 1 ? '' : 's'
        }`
      : tone === 'amber'
        ? `${summary.counters.conflicts} conflict${summary.counters.conflicts === 1 ? '' : 's'}`
        : `${summary.counters.saves} save${summary.counters.saves === 1 ? '' : 's'}`;

  const tooltip = [
    `Saves: ${summary.counters.saves}`,
    `Conflicts: ${summary.counters.conflicts}`,
    `Auto-merges: ${summary.counters.autoMerges}`,
    `Fails: ${summary.counters.saveFails}`,
    `Crashes: ${summary.counters.crashes}`,
    `Clips: ${summary.counters.clips}`,
  ].join(' · ');

  return (
    <Link
      href="/diagnostics"
      title={tooltip}
      className={cn(
        'flex items-center gap-2 rounded-md text-xs hover:bg-[var(--bg-hover)] transition-colors',
        collapsed ? 'justify-center h-7 w-7' : 'px-2 py-1.5',
        tone === 'red'
          ? 'text-[var(--red-dim)]'
          : tone === 'amber'
            ? 'text-[var(--color-warning)]'
            : 'text-[var(--fg-muted)]'
      )}
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', TONE_DOT[tone])} />
      {!collapsed && <span className="truncate">{label} · 24h</span>}
    </Link>
  );
}
