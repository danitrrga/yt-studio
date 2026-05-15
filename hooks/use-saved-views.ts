'use client';

import { useSyncExternalStore } from 'react';
import { loadSavedViews, saveSavedViews, type SavedView } from '@/lib/saved-views';

let cache: SavedView[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (!hydrated && typeof window !== 'undefined') {
    cache = loadSavedViews();
    hydrated = true;
    queueMicrotask(emit);
  }
  return () => listeners.delete(l);
}

function getSnapshot(): SavedView[] {
  return cache;
}

const SERVER_SNAPSHOT: SavedView[] = [];
function getServerSnapshot(): SavedView[] {
  return SERVER_SNAPSHOT;
}

export function useSavedViews(): SavedView[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function addSavedView(v: SavedView) {
  cache = [...cache, v];
  saveSavedViews(cache);
  emit();
}

export function removeSavedView(id: string) {
  cache = cache.filter((v) => v.id !== id);
  saveSavedViews(cache);
  emit();
}

export function renameSavedView(id: string, name: string) {
  cache = cache.map((v) => (v.id === id ? { ...v, name } : v));
  saveSavedViews(cache);
  emit();
}
