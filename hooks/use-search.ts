'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import type { SearchResult } from '@/lib/search';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useGlobalSearch(query: string) {
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) {
      setDebounced('');
      return;
    }
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useSWR<SearchResult>(
    debounced ? `/api/search?q=${encodeURIComponent(debounced)}` : null,
    fetcher,
    { keepPreviousData: true }
  );

  const hasResults =
    !!data &&
    (data.videos.length > 0 || data.clips.length > 0 || data.docs.length > 0);

  return { results: data ?? null, isSearching: isLoading && !!debounced, hasResults };
}
