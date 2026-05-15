// Phase 0 foundation: single logging primitive.
// Server: logs to stdout (Docker captures).
// Client: buffers and POSTs to /api/log (best-effort).

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  ts: string;
  level: LogLevel;
  scope: string;
  msg: string;
  data?: unknown;
}

const isServer = typeof window === 'undefined';
const clientBuffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function emit(level: LogLevel, scope: string, msg: string, data?: unknown) {
  const entry: LogEntry = { ts: new Date().toISOString(), level, scope, msg, data };
  if (isServer) {
    const line = JSON.stringify(entry);
    if (level === 'error' || level === 'warn') process.stderr.write(line + '\n');
    else process.stdout.write(line + '\n');
    return;
  }
  clientBuffer.push(entry);
  if (!flushTimer) flushTimer = setTimeout(flush, 500);
}

async function flush() {
  flushTimer = null;
  if (clientBuffer.length === 0) return;
  const batch = clientBuffer.splice(0, clientBuffer.length);
  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: batch }),
    });
  } catch {
    // Best-effort; logs are non-critical. Drop.
  }
}

export const logger = {
  debug: (scope: string, msg: string, data?: unknown) => emit('debug', scope, msg, data),
  info: (scope: string, msg: string, data?: unknown) => emit('info', scope, msg, data),
  warn: (scope: string, msg: string, data?: unknown) => emit('warn', scope, msg, data),
  error: (scope: string, msg: string, data?: unknown) => emit('error', scope, msg, data),
};
