/**
 * Client-side telemetry helper. Buffers events and flushes every 5s
 * (or on `pagehide`, whichever first). Fire-and-forget — never blocks
 * the UI path. Mirrors to console at the appropriate level so dev
 * output stays useful.
 *
 * Usage:
 *   recordEvent({ scope: 'editor', event: 'save.ok', level: 'info', slug, durationMs });
 */

import type { TelemetryEvent, TelemetryLevel, TelemetryScope } from './types';

const FLUSH_INTERVAL_MS = 5_000;
const MAX_BATCH = 50;

interface ClientEvent {
  scope: TelemetryScope;
  event: string;
  level: TelemetryLevel;
  slug?: string;
  durationMs?: number;
  payload?: Record<string, unknown>;
}

const buffer: TelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pageHideBound = false;

function bindPageHide() {
  if (pageHideBound) return;
  if (typeof window === 'undefined') return;
  pageHideBound = true;
  window.addEventListener(
    'pagehide',
    () => {
      // Use sendBeacon when available so the request survives the unload.
      if (buffer.length === 0) return;
      const batch = buffer.splice(0, buffer.length);
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify(batch)], {
            type: 'application/json',
          });
          navigator.sendBeacon('/api/events/log', blob);
          return;
        }
      } catch {
        // fall through to fetch
      }
      fetch('/api/events/log', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      }).catch(() => undefined);
    },
    { capture: true }
  );
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_INTERVAL_MS);
}

async function flush(): Promise<void> {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, MAX_BATCH);
  try {
    await fetch('/api/events/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });
  } catch {
    // Drop on failure — telemetry must not block UX. Server-side logger
    // captures most events too via direct calls.
  }
}

export function recordEvent(e: ClientEvent): void {
  // Console mirror so dev tools still show structured logs.
  const line = `[${e.scope}.${e.event}] ${e.slug ?? ''}`.trim();
  if (e.level === 'error') console.error(line, e.payload ?? '');
  else if (e.level === 'warn') console.warn(line, e.payload ?? '');
  // info-level mirror suppressed to avoid console flood

  buffer.push({
    ts: new Date().toISOString(),
    scope: e.scope,
    event: e.event,
    level: e.level,
    slug: e.slug,
    durationMs: e.durationMs,
    payload: e.payload,
  });

  bindPageHide();
  if (buffer.length >= MAX_BATCH) {
    void flush();
    return;
  }
  scheduleFlush();
}

/** Used by tests / manual-flush call sites. */
export async function flushTelemetryNow(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flush();
}
