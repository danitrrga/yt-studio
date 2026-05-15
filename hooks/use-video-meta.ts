'use client';

import useSWR from 'swr';
import type { VideoMeta, VideoMetaSection } from '@/lib/types';

const fetcher = async (url: string): Promise<VideoMeta | null> => {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Meta fetch failed: ${res.status}`);
  return res.json();
};

export function useVideoMeta(slug: string | null) {
  const { data, error, isLoading, mutate } = useSWR<VideoMeta | null>(
    slug ? `/api/videos/${slug}/meta` : null,
    fetcher
  );
  return { meta: data, error, isLoading, mutate };
}

export async function saveVideoMeta(
  slug: string,
  sections: VideoMetaSection[]
): Promise<VideoMeta> {
  const res = await fetch(`/api/videos/${slug}/meta`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sections }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Failed to save meta');
  }
  return res.json();
}
