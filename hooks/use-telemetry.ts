'use client';

import useSWR from 'swr';
import type { TelemetrySummaryWindow, TelemetryEvent } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useEventSummary(window: TelemetrySummaryWindow['window'] = '24h') {
  const { data, error, isLoading, mutate } = useSWR<TelemetrySummaryWindow>(
    `/api/events/summary?window=${window}`,
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
    }
  );
  return { summary: data, error, isLoading, mutate };
}

interface EventLogQuery {
  since?: string;
  scope?: string;
  level?: string;
  search?: string;
  limit?: number;
}

export function useEventLog(query: EventLogQuery = {}) {
  const params = new URLSearchParams();
  if (query.since) params.set('since', query.since);
  if (query.scope) params.set('scope', query.scope);
  if (query.level) params.set('level', query.level);
  if (query.search) params.set('search', query.search);
  if (query.limit) params.set('limit', String(query.limit));
  const url = `/api/events/log?${params.toString()}`;
  const { data, error, isLoading, mutate } = useSWR<TelemetryEvent[]>(url, fetcher);
  return { events: data, error, isLoading, mutate };
}
