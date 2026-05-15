'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { viewStore } from './use-view-store';
import {
  loadPersisted,
  savePersisted,
  decodeView,
  encodeView,
  getBuiltinByUrlKey,
} from '@/lib/view-persistence';
import { readSettings } from '@/lib/settings';

export function useViewPersist() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useRef(false);
  const lastDecoded = useRef<string | null>(null);
  const urlWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    const urlParam = searchParams.get('v');
    const persisted = loadPersisted();

    // First-time use: apply user's settings defaults (default view + density).
    // Detected by the absence of the persistence key — every other branch
    // already returns DEFAULT shaped values, but only the empty-key case
    // means the user hasn't customized anything.
    const isFirstTime =
      typeof window !== 'undefined' && !window.localStorage.getItem('yts:views:v1');
    if (isFirstTime) {
      const settings = readSettings();
      persisted.activeView = settings.defaultViewMode;
      for (const k of Object.keys(persisted.views) as Array<keyof typeof persisted.views>) {
        persisted.views[k] = {
          ...persisted.views[k],
          density: settings.defaultDensity,
        };
      }
    }

    viewStore.hydrate({
      activeView: persisted.activeView,
      views: persisted.views,
    });

    if (urlParam) {
      applyUrlParam(urlParam);
      lastDecoded.current = urlParam;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-decode when URL v= changes from external nav (preset link, back/forward, etc.)
  useEffect(() => {
    if (!hydrated.current) return;
    const urlParam = searchParams.get('v');
    if (urlParam === lastDecoded.current) return;
    if (!urlParam) {
      lastDecoded.current = null;
      return;
    }
    if (applyUrlParam(urlParam)) {
      lastDecoded.current = urlParam;
    }
  }, [searchParams]);

  // (helper) Apply a URL preset key or base64 payload to the live store.
  // Builtins also switch the active view mode (e.g. Roadmap → timeline);
  // inbox + base64 payloads only update the active view's state.
  function applyUrlParam(urlParam: string): boolean {
    const builtin = getBuiltinByUrlKey(urlParam);
    if (builtin) {
      viewStore.setActiveView(builtin.mode);
      viewStore.setActiveViewState(builtin.state);
      return true;
    }
    const decoded = decodeView(urlParam);
    if (decoded) {
      viewStore.setActiveViewState(decoded);
      return true;
    }
    return false;
  }

  useEffect(() => {
    if (!hydrated.current) return;
    const unsub = viewStore.subscribe(() => {
      const s = viewStore.getState();
      savePersisted({ activeView: s.activeView, views: s.views });

      if (urlWriteTimer.current) clearTimeout(urlWriteTimer.current);
      urlWriteTimer.current = setTimeout(() => {
        const v = s.views[s.activeView];
        const hasAny = v.filter.children.length > 0 || v.sort.length > 0 || v.search.length > 0;
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        if (hasAny) {
          const encoded = encodeView(v);
          url.searchParams.set('v', encoded);
          lastDecoded.current = encoded;
        } else {
          url.searchParams.delete('v');
          lastDecoded.current = null;
        }
        const next = url.pathname + (url.search ? url.search : '');
        router.replace(next, { scroll: false });
      }, 250);
    });
    return () => {
      unsub();
      if (urlWriteTimer.current) clearTimeout(urlWriteTimer.current);
    };
  }, [router]);
}
