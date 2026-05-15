'use client';

import { useMemo } from 'react';
import { useVideos } from './use-videos';

export function useVideoNavigation(currentSlug: string) {
  const { videos } = useVideos();
  return useMemo(() => {
    if (!videos || videos.length === 0) return { prev: null, next: null, index: -1, total: 0 };
    const idx = videos.findIndex((v) => v.slug === currentSlug);
    if (idx === -1) return { prev: null, next: null, index: -1, total: videos.length };
    const prev = idx > 0 ? videos[idx - 1].slug : null;
    const next = idx < videos.length - 1 ? videos[idx + 1].slug : null;
    return { prev, next, index: idx, total: videos.length };
  }, [videos, currentSlug]);
}
