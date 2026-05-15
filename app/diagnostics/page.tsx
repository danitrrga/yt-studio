'use client';

import { useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Activity, RefreshCw } from 'lucide-react';
import { useEventLog, useEventSummary } from '@/hooks/use-telemetry';
import type { TelemetrySummaryWindow } from '@/lib/types';
import { CounterCard } from './CounterCard';
import { EventTable } from './EventTable';
import { cn } from '@/lib/utils';

const WINDOW_OPTIONS: { id: TelemetrySummaryWindow['window']; label: string; hours: number }[] = [
  { id: '24h', label: '24 hours', hours: 24 },
  { id: '7d', label: '7 days', hours: 24 * 7 },
  { id: '30d', label: '30 days', hours: 24 * 30 },
];

const SCOPE_OPTIONS = ['editor', 'vault', 'hub', 'video', 'thumbnail', 'watcher', 'route', 'api'];
const LEVEL_OPTIONS = ['info', 'warn', 'error'];

type CounterId =
  | 'saves'
  | 'saveFails'
  | 'conflicts'
  | 'autoMerges'
  | 'clips'
  | 'converts'
  | 'uploads'
  | 'crashes';

const COUNTER_FILTERS: Record<CounterId, { scope?: string; level?: string; search?: string } | null> = {
  saves: { scope: 'editor', search: 'save.ok' },
  saveFails: { level: 'error' },
  conflicts: { scope: 'editor', search: 'merge.conflict' },
  autoMerges: { scope: 'editor', search: 'merge.auto' },
  clips: { scope: 'hub', search: 'clip.captured' },
  converts: { scope: 'hub', search: 'clip.converted' },
  uploads: { search: 'uploaded' },
  crashes: { scope: 'route', search: 'error' },
};

export default function DiagnosticsPage() {
  const [window, setWindow] = useState<TelemetrySummaryWindow['window']>('24h');
  const [scope, setScope] = useState<string>('');
  const [level, setLevel] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [activeCounter, setActiveCounter] = useState<CounterId | null>(null);

  const { summary, isLoading: summaryLoading, mutate: mutateSummary } = useEventSummary(window);

  const sinceISO = useMemo(() => {
    const w = WINDOW_OPTIONS.find((o) => o.id === window) ?? WINDOW_OPTIONS[0];
    return new Date(Date.now() - w.hours * 60 * 60 * 1000).toISOString();
  }, [window]);

  const { events, isLoading: eventsLoading, mutate: mutateEvents } = useEventLog({
    since: sinceISO,
    scope: scope || undefined,
    level: level || undefined,
    search: search || undefined,
    limit: 500,
  });

  const refresh = () => {
    fetch(`/api/events/summary?window=${window}&fresh=1`).catch(() => undefined);
    mutateSummary();
    mutateEvents();
  };

  const applyCounterFilter = (id: CounterId) => {
    const f = COUNTER_FILTERS[id];
    if (!f) return;
    if (activeCounter === id) {
      setActiveCounter(null);
      setScope('');
      setLevel('');
      setSearch('');
      return;
    }
    setActiveCounter(id);
    setScope(f.scope ?? '');
    setLevel(f.level ?? '');
    setSearch(f.search ?? '');
  };

  const clearFilters = () => {
    setActiveCounter(null);
    setScope('');
    setLevel('');
    setSearch('');
  };

  const c = summary?.counters;
  const sl = summary?.sparklines;
  const computedLabel = summary
    ? `Computed ${formatDistanceToNow(new Date(summary.computedAt), { addSuffix: true })}`
    : '';

  return (
    <div className="px-8 py-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.012em] leading-[1.2] inline-flex items-center gap-2">
            <Activity className="w-5 h-5 text-[var(--color-fg-secondary)]" />
            Diagnostics
          </h1>
          <p className="text-[13px] text-[var(--color-fg-muted)] mt-1">
            app health and recent events. {computedLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border overflow-hidden text-xs">
            {WINDOW_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => setWindow(o.id)}
                className={cn(
                  'px-3 h-8 transition-colors',
                  window === o.id
                    ? 'bg-[var(--fg)] text-black'
                    : 'bg-[var(--color-surface)] text-[var(--color-fg-secondary)] hover:bg-[var(--color-surface-hover)]'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button
            onClick={refresh}
            title="Refresh"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md border bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-fg-secondary)]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Counter band */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <CounterCard
          label="Saves"
          value={c?.saves ?? 0}
          tone="good"
          sparkline={sl?.saves}
          active={activeCounter === 'saves'}
          onClick={() => applyCounterFilter('saves')}
        />
        <CounterCard
          label="Save fails"
          value={c?.saveFails ?? 0}
          tone={c && c.saveFails > 0 ? 'bad' : 'neutral'}
          sparkline={sl?.fails}
          active={activeCounter === 'saveFails'}
          onClick={() => applyCounterFilter('saveFails')}
        />
        <CounterCard
          label="Conflicts"
          value={c?.conflicts ?? 0}
          tone={c && c.conflicts > 0 ? 'warn' : 'neutral'}
          sparkline={sl?.conflicts}
          active={activeCounter === 'conflicts'}
          onClick={() => applyCounterFilter('conflicts')}
        />
        <CounterCard
          label="Auto-merges"
          value={c?.autoMerges ?? 0}
          tone="neutral"
          active={activeCounter === 'autoMerges'}
          onClick={() => applyCounterFilter('autoMerges')}
        />
        <CounterCard
          label="Clips"
          value={c?.clips ?? 0}
          tone="neutral"
          sparkline={sl?.clips}
          active={activeCounter === 'clips'}
          onClick={() => applyCounterFilter('clips')}
        />
        <CounterCard
          label="Converts"
          value={c?.converts ?? 0}
          tone="neutral"
          active={activeCounter === 'converts'}
          onClick={() => applyCounterFilter('converts')}
        />
        <CounterCard
          label="Uploads"
          value={c?.uploads ?? 0}
          tone="neutral"
          active={activeCounter === 'uploads'}
          onClick={() => applyCounterFilter('uploads')}
        />
        <CounterCard
          label="Crashes"
          value={c?.crashes ?? 0}
          tone={c && c.crashes > 0 ? 'bad' : 'neutral'}
          active={activeCounter === 'crashes'}
          onClick={() => applyCounterFilter('crashes')}
        />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={scope}
          onChange={(e) => {
            setScope(e.target.value);
            setActiveCounter(null);
          }}
          className="h-8 px-2.5 rounded-md border bg-[var(--color-surface)] text-xs outline-none"
        >
          <option value="">All scopes</option>
          {SCOPE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
            setActiveCounter(null);
          }}
          className="h-8 px-2.5 rounded-md border bg-[var(--color-surface)] text-xs outline-none"
        >
          <option value="">All levels</option>
          {LEVEL_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search event / slug / payload…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setActiveCounter(null);
          }}
          className="h-8 px-2.5 rounded-md border bg-[var(--color-surface)] text-xs outline-none flex-1 min-w-[200px]"
        />
        {(scope || level || search) && (
          <button
            onClick={clearFilters}
            className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-[var(--color-fg-muted)] tabular-nums">
          {events?.length ?? 0} events
        </span>
      </div>

      <EventTable events={events} isLoading={eventsLoading} />

      <div className="text-[11px] text-[var(--color-fg-muted)] pt-4 border-t">
        NDJSON store at <code>vault/0 - System/diagnostics/events-{format(new Date(), 'yyyy-MM-dd')}.ndjson</code>
        {' · '}
        30-day retention
        {summaryLoading && ' · refreshing…'}
      </div>
    </div>
  );
}
