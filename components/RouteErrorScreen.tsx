'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RotateCcw, Activity } from 'lucide-react';
import { recordEvent } from '@/lib/telemetry';

/**
 * Reusable error UI for Next.js route segment error boundaries.
 * Records a `route.error` event on mount and renders a recovery card.
 */
export function RouteErrorScreen({
  error,
  reset,
  routeLabel,
  routePath,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  routeLabel: string;
  routePath: string;
}) {
  useEffect(() => {
    recordEvent({
      scope: 'route',
      event: 'error',
      level: 'error',
      payload: {
        path: routePath,
        error: error.message,
        digest: error.digest,
      },
    });
  }, [error, routePath]);

  return (
    <div className="px-8 py-12 max-w-[760px] mx-auto">
      <div className="rounded-xl border bg-[var(--color-surface)] p-8 space-y-5">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-7 h-7 text-[hsl(var(--color-overdue))]" />
          <div>
            <h1 className="text-xl font-bold">Something broke on {routeLabel}</h1>
            <p className="text-sm text-[var(--color-fg-muted)] mt-0.5">
              Logged to diagnostics. Try reloading or head home.
            </p>
          </div>
        </div>
        <pre className="text-[11px] font-mono whitespace-pre-wrap break-all rounded-md bg-[var(--color-surface-elevated)] p-3 text-[hsl(var(--color-overdue))] max-h-48 overflow-y-auto">
          {error.message}
          {error.digest && `\n\ndigest: ${error.digest}`}
        </pre>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-[var(--color-button-primary)] text-[var(--color-button-primary-fg)] text-sm font-medium hover:bg-[var(--color-button-primary-hover)]"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md border text-sm hover:bg-[var(--color-surface-hover)]"
          >
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
          <Link
            href="/diagnostics"
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md border text-sm hover:bg-[var(--color-surface-hover)]"
          >
            <Activity className="w-4 h-4" />
            Diagnostics
          </Link>
        </div>
      </div>
    </div>
  );
}
