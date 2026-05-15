'use client';

import { useSyncExternalStore } from 'react';

interface State {
  ids: Set<string>;
  anchor: string | null;
}

let state: State = { ids: new Set(), anchor: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const api = {
  has(slug: string): boolean {
    return state.ids.has(slug);
  },
  size(): number {
    return state.ids.size;
  },
  list(): string[] {
    return Array.from(state.ids);
  },
  toggle(slug: string) {
    const ids = new Set(state.ids);
    if (ids.has(slug)) ids.delete(slug);
    else ids.add(slug);
    state = { ids, anchor: slug };
    emit();
  },
  add(slug: string) {
    const ids = new Set(state.ids);
    ids.add(slug);
    state = { ids, anchor: slug };
    emit();
  },
  toggleRange(slug: string, ordered: string[]) {
    const ids = new Set(state.ids);
    const anchorIdx = state.anchor ? ordered.indexOf(state.anchor) : -1;
    const targetIdx = ordered.indexOf(slug);
    if (anchorIdx === -1 || targetIdx === -1) {
      ids.add(slug);
    } else {
      const [lo, hi] = anchorIdx <= targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
      for (let i = lo; i <= hi; i++) ids.add(ordered[i]);
    }
    state = { ids, anchor: slug };
    emit();
  },
  setAll(slugs: string[]) {
    state = { ids: new Set(slugs), anchor: slugs[0] ?? null };
    emit();
  },
  clear() {
    if (state.ids.size === 0 && state.anchor === null) return;
    state = { ids: new Set(), anchor: null };
    emit();
  },
};

export const selection = api;

export function useSelectionIds(): Set<string> {
  return useSyncExternalStore(
    subscribe,
    () => state.ids,
    () => state.ids
  );
}

export function useSelectionSize(): number {
  return useSyncExternalStore(
    subscribe,
    () => state.ids.size,
    () => state.ids.size
  );
}
