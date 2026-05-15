'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { TelemetryEvent, TelemetryLevel } from '@/lib/types';
import { cn } from '@/lib/utils';

const LEVEL_DOT: Record<TelemetryLevel, string> = {
  info: 'bg-[var(--color-fg-muted)]',
  warn: 'bg-[hsl(var(--color-warn))]',
  error: 'bg-[hsl(var(--color-overdue))]',
};

const LEVEL_TEXT: Record<TelemetryLevel, string> = {
  info: 'text-[var(--color-fg-secondary)]',
  warn: 'text-[hsl(var(--color-warn))]',
  error: 'text-[hsl(var(--color-overdue))]',
};

function detail(e: TelemetryEvent): string {
  const parts: string[] = [];
  if (e.slug) parts.push(e.slug);
  if (typeof e.durationMs === 'number') parts.push(`${e.durationMs}ms`);
  const payload = e.payload ?? {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === 'error') continue;
    if (typeof v === 'string') parts.push(`${k}=${v}`);
    else if (typeof v === 'number') parts.push(`${k}=${v}`);
    else if (typeof v === 'boolean') parts.push(`${k}=${v}`);
  }
  return parts.join(' · ');
}

function videoLink(e: TelemetryEvent): string | null {
  if (!e.slug) return null;
  if (e.scope === 'editor' || e.scope === 'video') return `/videos/${e.slug}`;
  if (e.scope === 'hub') return `/hub/${e.slug}`;
  if (e.scope === 'thumbnail') return `/videos/${e.slug}`;
  return null;
}

export function EventTable({ events, isLoading }: { events: TelemetryEvent[] | undefined; isLoading: boolean }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rows = useMemo(() => events ?? [], [events]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return <div className="px-4 py-6 text-sm text-[var(--color-fg-muted)]">Loading events…</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-[var(--color-fg-muted)]">
        No events match the current filter.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-[var(--color-surface)] overflow-hidden">
      <div className="grid grid-cols-[80px_90px_180px_60px_1fr] gap-3 px-3 h-9 items-center border-b font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--color-fg-muted)]">
        <span>Time</span>
        <span>Scope</span>
        <span>Event</span>
        <span>Level</span>
        <span>Detail</span>
      </div>
      <ul className="divide-y divide-[var(--color-border-subtle)] max-h-[60vh] overflow-y-auto">
        {rows.map((e, i) => {
          const id = `${e.ts}-${i}`;
          const isOpen = expanded.has(id);
          const errMsg = (e.payload?.error as string) || (e.level === 'error' ? 'Error' : null);
          const link = videoLink(e);
          return (
            <li key={id} className="text-xs">
              <button
                type="button"
                onClick={() => (errMsg ? toggle(id) : null)}
                className={cn(
                  'w-full grid grid-cols-[80px_90px_180px_60px_1fr] gap-3 px-3 py-2 items-center text-left',
                  errMsg && 'cursor-pointer hover:bg-[var(--color-surface-hover)]'
                )}
              >
                <span className="text-[var(--color-fg-muted)] tabular-nums">
                  {format(new Date(e.ts), 'HH:mm:ss')}
                </span>
                <span className="text-[var(--color-fg-secondary)] truncate">{e.scope}</span>
                <span className="font-medium truncate">{e.event}</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn('w-1.5 h-1.5 rounded-full', LEVEL_DOT[e.level])} />
                  <span className={LEVEL_TEXT[e.level]}>{e.level}</span>
                </span>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate text-[var(--color-fg-secondary)]">{detail(e)}</span>
                  {link && (
                    <Link
                      href={link}
                      onClick={(ev) => ev.stopPropagation()}
                      className="ml-auto text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] shrink-0"
                    >
                      Open →
                    </Link>
                  )}
                  {errMsg && (
                    <span className="ml-1 text-[var(--color-fg-muted)] shrink-0">
                      {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </span>
                  )}
                </span>
              </button>
              {isOpen && errMsg && (
                <div className="px-3 pb-3 pl-[calc(80px+90px+180px+60px+3rem)] text-[11px] text-[hsl(var(--color-overdue))] font-mono whitespace-pre-wrap break-all">
                  {errMsg}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
