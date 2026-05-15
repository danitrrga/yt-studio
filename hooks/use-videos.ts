'use client';

import useSWR from 'swr';
import { useEffect, useRef } from 'react';
import type { VideoSummary, Video, HubPage, FileChangeEvent } from '@/lib/types';
import { logger } from '@/lib/logger';
import { recordEvent } from '@/lib/telemetry';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const MAX_RETRIES = 10;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const FETCH_TIMEOUT_MS = 10_000;

export function useVideos() {
  const { data, error, isLoading, mutate } = useSWR<VideoSummary[]>(
    '/api/videos',
    fetcher
  );

  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;

  useEffect(() => {
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let es: EventSource | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      es = new EventSource('/api/events');

      es.onopen = () => {
        retries = 0;
        logger.debug('use-videos.sse', 'connected');
        recordEvent({ scope: 'watcher', event: 'connected', level: 'info' });
      };

      es.onmessage = (msg) => {
        try {
          const event: FileChangeEvent = JSON.parse(msg.data);
          if (event) mutateRef.current();
        } catch {
          // Ignore non-JSON ping/keepalive messages
        }
      };

      es.onerror = () => {
        if (es) es.close();
        es = null;
        if (disposed) return;
        if (retries >= MAX_RETRIES) {
          logger.error('use-videos.sse', 'max retries exhausted, giving up');
          return;
        }
        const backoff = Math.min(
          INITIAL_BACKOFF_MS * Math.pow(2, retries),
          MAX_BACKOFF_MS
        );
        retries += 1;
        logger.warn('use-videos.sse', 'reconnect scheduled', { retries, backoff });
        recordEvent({
          scope: 'watcher',
          event: 'disconnected',
          level: 'warn',
          payload: { retries, backoff },
        });
        retryTimer = setTimeout(connect, backoff);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (es) es.close();
    };
  }, []);

  return { videos: data, error, isLoading, mutate };
}

export function useSlugSet(): Set<string> {
  const { videos } = useVideos();
  return new Set((videos ?? []).map((v) => v.slug));
}

export function useIdeaCount(): number {
  const { videos } = useVideos();
  return (videos ?? []).filter((v) => v.frontmatter.status === 'idea').length;
}

export function useVideo(slug: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Video>(
    slug ? `/api/videos/${slug}` : null,
    fetcher
  );
  return { video: data, error, isLoading, mutate };
}

export function useHubPages() {
  const { data, error, isLoading } = useSWR<HubPage[]>('/api/hub/pages', fetcher);
  return { pages: data, error, isLoading };
}

export async function deleteVideoRequest(slug: string): Promise<{ slug: string; trashedAt: number }> {
  const res = await fetch(`/api/videos/${slug}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Delete failed');
  }
  return res.json();
}

export async function restoreVideoRequest(slug: string, trashedAt: number) {
  const res = await fetch('/api/videos/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, trashedAt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Restore failed');
  }
  return res.json();
}

export async function updateVideoField(
  slug: string,
  updates: Record<string, unknown>
) {
  return updateVideoRaw(slug, { frontmatter: updates });
}

export async function updateVideoBody(slug: string, body: string) {
  return updateVideoRaw(slug, { body });
}

async function updateVideoRaw(
  slug: string,
  payload: { frontmatter?: Record<string, unknown>; body?: string }
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`/api/videos/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(`Update failed (${res.status}): ${msg}`);
    }
    return res.json();
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('Save timed out after 10s');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
