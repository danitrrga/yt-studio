'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { loadUIState, saveUIState, type UIState } from '@/lib/ui-state';
import type { VideoStatus } from '@/lib/types';

export interface QuickAddPrefill {
  status?: VideoStatus;
  targetDate?: string;
}

interface UIContextValue {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  focus: boolean;
  toggleFocus: () => void;
  setFocus: (v: boolean) => void;
  fullscreen: boolean;
  toggleFullscreen: () => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (v: boolean) => void;
  quickAddOpen: boolean;
  setQuickAddOpen: (v: boolean) => void;
  quickAddPrefill: QuickAddPrefill | null;
  openQuickAdd: (prefill?: QuickAddPrefill) => void;
  metadataCollapsed: boolean;
  toggleMetadata: () => void;
  writingMode: boolean;
  toggleWritingMode: () => void;
  setWritingMode: (v: boolean) => void;
  pathname: string;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<UIState>({
    sidebarCollapsed: false,
    focusByPage: {},
    metadataSidebarCollapsed: false,
  });
  const [hydrated, setHydrated] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpenRaw] = useState(false);
  const [quickAddPrefill, setQuickAddPrefill] = useState<QuickAddPrefill | null>(null);
  const [writingMode, setWritingMode] = useState(false);

  const setQuickAddOpen = useCallback((v: boolean) => {
    if (!v) setQuickAddPrefill(null);
    setQuickAddOpenRaw(v);
  }, []);

  const openQuickAdd = useCallback((prefill?: QuickAddPrefill) => {
    setQuickAddPrefill(prefill ?? null);
    setQuickAddOpenRaw(true);
  }, []);

  useEffect(() => {
    setState(loadUIState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveUIState(state);
  }, [state, hydrated]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleSidebar = useCallback(() => {
    setState((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }));
  }, []);

  const focus = !!state.focusByPage[pathname];

  const setFocus = useCallback(
    (v: boolean) => {
      setState((s) => ({
        ...s,
        focusByPage: { ...s.focusByPage, [pathname]: v },
      }));
    },
    [pathname]
  );

  const toggleFocus = useCallback(() => setFocus(!focus), [focus, setFocus]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
  }, []);

  const toggleMetadata = useCallback(() => {
    setState((s) => ({ ...s, metadataSidebarCollapsed: !s.metadataSidebarCollapsed }));
  }, []);

  const toggleWritingMode = useCallback(() => setWritingMode((v) => !v), []);

  const value = useMemo<UIContextValue>(
    () => ({
      sidebarCollapsed: state.sidebarCollapsed,
      toggleSidebar,
      focus,
      toggleFocus,
      setFocus,
      fullscreen,
      toggleFullscreen,
      shortcutsOpen,
      setShortcutsOpen,
      quickAddOpen,
      setQuickAddOpen,
      quickAddPrefill,
      openQuickAdd,
      metadataCollapsed: state.metadataSidebarCollapsed,
      toggleMetadata,
      writingMode,
      toggleWritingMode,
      setWritingMode,
      pathname,
    }),
    [
      state.sidebarCollapsed,
      state.metadataSidebarCollapsed,
      focus,
      fullscreen,
      shortcutsOpen,
      quickAddOpen,
      quickAddPrefill,
      writingMode,
      pathname,
      toggleSidebar,
      toggleFocus,
      setFocus,
      toggleFullscreen,
      setShortcutsOpen,
      setQuickAddOpen,
      openQuickAdd,
      toggleMetadata,
      toggleWritingMode,
      setWritingMode,
    ]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be inside UIProvider');
  return ctx;
}
