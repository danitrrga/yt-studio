import { subscribe } from '@/lib/watcher';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const KEEPALIVE_MS = 30_000;

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | null = null;
      let keepalive: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (unsubscribe) try { unsubscribe(); } catch {}
        if (keepalive) clearInterval(keepalive);
        try { controller.close(); } catch {}
      };

      try {
        controller.enqueue(encoder.encode(': connected\n\n'));
      } catch {
        cleanup();
        return;
      }

      unsubscribe = subscribe((event) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          cleanup();
        }
      });

      keepalive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          cleanup();
        }
      }, KEEPALIVE_MS);
    },

    cancel() {
      // Stream consumer (client) disconnected — nothing to do, cleanup fires from `start`'s closure
      logger.debug('api.events', 'stream cancelled by client');
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
