/**
 * Server-side telemetry store. Append-only NDJSON, one file per day.
 *
 * Files: <root>/.diagnostics/events-YYYY-MM-DD.ndjson
 * Retention: 30 days, swept on cold start.
 *
 * Privacy default: events never carry file body content. Callers must pass
 * slugs / counters / error messages only. The schema rejects unknown payload
 * keys >256B at write-time as a defensive belt.
 */

import fs from 'fs/promises';
import path from 'path';
import type { TelemetryEvent, TelemetrySummaryWindow } from './types';
import { logger } from './logger';
import { getYtPaths } from './yt-config';

const RETENTION_DAYS = 30;
const PAYLOAD_MAX_BYTES = 4 * 1024;
const FILENAME_RE = /^events-(\d{4}-\d{2}-\d{2})\.ndjson$/;

let bootstrapped = false;

async function getDiagDir(): Promise<string> {
  const { diagnosticsDir } = await getYtPaths();
  return diagnosticsDir;
}

async function ensureDir(): Promise<void> {
  if (bootstrapped) return;
  const dir = await getDiagDir();
  await fs.mkdir(dir, { recursive: true });
  await purgeOldFiles().catch(() => undefined);
  bootstrapped = true;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function clampPayload(payload: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!payload) return undefined;
  const json = JSON.stringify(payload);
  if (json.length <= PAYLOAD_MAX_BYTES) return payload;
  return { _truncated: true, _bytes: json.length };
}

export async function recordEvents(rawEvents: Omit<TelemetryEvent, 'ts'>[] | TelemetryEvent[]): Promise<void> {
  if (!Array.isArray(rawEvents) || rawEvents.length === 0) return;
  await ensureDir();

  const now = new Date();
  const stamped: TelemetryEvent[] = rawEvents.map((e) => ({
    ts: 'ts' in e && e.ts ? e.ts : now.toISOString(),
    scope: e.scope,
    event: e.event,
    level: e.level,
    slug: e.slug,
    durationMs: e.durationMs,
    payload: clampPayload(e.payload),
  }));

  // Group by day so a flush at midnight lands in the right file.
  const byDay = new Map<string, TelemetryEvent[]>();
  for (const ev of stamped) {
    const day = ev.ts.slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(ev);
    byDay.set(day, arr);
  }

  const dir = await getDiagDir();
  for (const [day, evs] of byDay) {
    const target = path.join(dir, `events-${day}.ndjson`);
    const block = evs.map((e) => JSON.stringify(e)).join('\n') + '\n';
    try {
      await fs.appendFile(target, block, 'utf-8');
    } catch (err) {
      logger.warn('telemetry.recordEvents', 'append failed', {
        target,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

interface QueryOpts {
  since?: Date;
  until?: Date;
  scope?: string;
  level?: string;
  search?: string;
  limit?: number;
}

export async function queryEvents(opts: QueryOpts = {}): Promise<TelemetryEvent[]> {
  await ensureDir();
  const since = opts.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const until = opts.until ?? new Date();
  const limit = Math.min(opts.limit ?? 500, 5000);

  const days: string[] = [];
  const cursor = new Date(since);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(until);
  end.setUTCHours(0, 0, 0, 0);
  while (cursor <= end) {
    days.push(ymd(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const dir = await getDiagDir();
  const out: TelemetryEvent[] = [];
  for (const day of days) {
    const file = path.join(dir, `events-${day}.ndjson`);
    let raw: string;
    try {
      raw = await fs.readFile(file, 'utf-8');
    } catch {
      continue;
    }
    for (const line of raw.split('\n')) {
      if (!line) continue;
      try {
        const ev = JSON.parse(line) as TelemetryEvent;
        const t = new Date(ev.ts).getTime();
        if (t < since.getTime() || t > until.getTime()) continue;
        if (opts.scope && ev.scope !== opts.scope) continue;
        if (opts.level && ev.level !== opts.level) continue;
        if (opts.search) {
          const q = opts.search.toLowerCase();
          const hay = `${ev.event} ${ev.slug ?? ''} ${JSON.stringify(ev.payload ?? {})}`.toLowerCase();
          if (!hay.includes(q)) continue;
        }
        out.push(ev);
      } catch {
        continue;
      }
    }
  }
  out.sort((a, b) => b.ts.localeCompare(a.ts));
  return out.slice(0, limit);
}

const summaryCache = new Map<string, { result: TelemetrySummaryWindow; at: number }>();
const SUMMARY_TTL_MS = 30_000;

const SPARK_BUCKETS = 8;

function windowMs(window: TelemetrySummaryWindow['window']): number {
  if (window === '24h') return 24 * 60 * 60 * 1000;
  if (window === '7d') return 7 * 24 * 60 * 60 * 1000;
  return 30 * 24 * 60 * 60 * 1000;
}

export async function summarize(window: TelemetrySummaryWindow['window']): Promise<TelemetrySummaryWindow> {
  const cached = summaryCache.get(window);
  if (cached && Date.now() - cached.at < SUMMARY_TTL_MS) return cached.result;

  const span = windowMs(window);
  const since = new Date(Date.now() - span);
  const events = await queryEvents({ since, limit: 100_000 });

  const counters = {
    saves: 0,
    saveFails: 0,
    conflicts: 0,
    autoMerges: 0,
    clips: 0,
    converts: 0,
    uploads: 0,
    crashes: 0,
  };
  const sparklines = {
    saves: new Array(SPARK_BUCKETS).fill(0),
    fails: new Array(SPARK_BUCKETS).fill(0),
    conflicts: new Array(SPARK_BUCKETS).fill(0),
    clips: new Array(SPARK_BUCKETS).fill(0),
  };
  const bucketMs = span / SPARK_BUCKETS;
  const start = since.getTime();

  for (const e of events) {
    const t = new Date(e.ts).getTime();
    const idx = Math.min(SPARK_BUCKETS - 1, Math.floor((t - start) / bucketMs));
    const key = `${e.scope}.${e.event}`;
    switch (key) {
      case 'editor.save.ok':
        counters.saves++;
        sparklines.saves[idx]++;
        break;
      case 'editor.save.failed':
      case 'vault.write.failed':
      case 'api.request.failed':
        counters.saveFails++;
        sparklines.fails[idx]++;
        break;
      case 'editor.merge.conflict':
        counters.conflicts++;
        sparklines.conflicts[idx]++;
        break;
      case 'editor.merge.auto':
        counters.autoMerges++;
        break;
      case 'hub.clip.captured':
        counters.clips++;
        sparklines.clips[idx]++;
        break;
      case 'hub.clip.converted':
        counters.converts++;
        break;
      case 'thumbnail.uploaded':
      case 'hub.thumbnail.downloaded':
        counters.uploads++;
        break;
      case 'route.error':
        counters.crashes++;
        break;
    }
  }

  const result: TelemetrySummaryWindow = {
    window,
    computedAt: new Date().toISOString(),
    counters,
    sparklines,
  };
  summaryCache.set(window, { result, at: Date.now() });
  return result;
}

export async function purgeOldFiles(): Promise<number> {
  const dir = await getDiagDir();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return 0;
  }
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let purged = 0;
  for (const name of entries) {
    const m = name.match(FILENAME_RE);
    if (!m) continue;
    const day = new Date(m[1] + 'T00:00:00Z').getTime();
    if (day < cutoff) {
      try {
        await fs.unlink(path.join(dir, name));
        purged++;
      } catch {
        // ignore
      }
    }
  }
  if (purged) logger.info('telemetry.purge', 'removed old files', { count: purged });
  return purged;
}

// Suppress the cache from a manual fresh request.
export function invalidateSummaryCache(): void {
  summaryCache.clear();
}

