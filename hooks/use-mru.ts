'use client';

import { useCallback, useSyncExternalStore } from 'react';

const KEY = 'yts:mru';
const MAX = 8;

export interface MRUEntry {
  slug: string;
  type: 'video' | 'clip' | 'doc';
  title: string;
  at: number; // timestamp
}

function read(): MRUEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as MRUEntry[];
  } catch {
    return [];
  }
}

function write(entries: MRUEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    // quota exceeded — silently drop
  }
  notify();
}

// External store for useSyncExternalStore
const listeners = new Set<() => void>();
const EMPTY: MRUEntry[] = [];
let snapshot: MRUEntry[] | null = null;

function notify() {
  snapshot = read();
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (snapshot === null) snapshot = read();

  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) notify();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot() {
  if (snapshot === null) snapshot = read();
  return snapshot;
}

function getServerSnapshot() {
  return EMPTY;
}

export function useMRU(): MRUEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function recordVisit(slug: string, type: MRUEntry['type'], title: string) {
  const entries = read().filter((e) => !(e.slug === slug && e.type === type));
  entries.unshift({ slug, type, title, at: Date.now() });
  write(entries);
}
