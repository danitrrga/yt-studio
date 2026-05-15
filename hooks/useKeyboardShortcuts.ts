'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useUI } from '@/components/UIProvider';
import { registerShortcut, matchesShortcut, getShortcuts, isMod } from '@/lib/shortcuts';
import { viewStore } from './use-view-store';
import type { VideoSummary } from '@/lib/types';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable ||
    !!target.closest('.cm-editor')
  );
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useKeyboardShortcuts() {
  const ui = useUI();
  const router = useRouter();
  const { data: videos } = useSWR<VideoSummary[]>('/api/videos', fetcher);

  // Register shortcuts once. Registrations update live; last writer wins per id.
  useEffect(() => {
    const onVideoPage = () => /^\/videos\/[^/]+$/.test(ui.pathname);
    const currentSlug = () => {
      const m = ui.pathname.match(/^\/videos\/([^/]+)$/);
      return m ? m[1] : null;
    };

    const unsubs: Array<() => void> = [];

    unsubs.push(
      registerShortcut({
        id: 'sidebar.toggle',
        keys: ['Mod', '\\'],
        scope: 'global',
        group: 'Navigation',
        label: 'Toggle sidebar',
        run: () => ui.toggleSidebar(),
      })
    );

    unsubs.push(
      registerShortcut({
        id: 'fullscreen.toggle',
        keys: ['Shift', 'F'],
        scope: 'global',
        group: 'Layout',
        label: 'Toggle fullscreen',
        run: () => ui.toggleFullscreen(),
      })
    );

    unsubs.push(
      registerShortcut({
        id: 'focus.toggle',
        keys: ['F'],
        scope: 'global',
        group: 'Layout',
        label: 'Focus mode (on /videos)',
        when: () => ui.pathname === '/videos',
        run: () => ui.toggleFocus(),
      })
    );

    unsubs.push(
      registerShortcut({
        id: 'escape',
        keys: ['Escape'],
        scope: 'global',
        group: 'Navigation',
        label: 'Exit mode / back',
        run: () => {
          if (ui.fullscreen) return;
          if (ui.writingMode) return ui.setWritingMode(false);
          if (ui.focus) return ui.setFocus(false);
          if (ui.shortcutsOpen) return ui.setShortcutsOpen(false);
          if (onVideoPage()) router.push('/videos');
        },
      })
    );

    unsubs.push(
      registerShortcut({
        id: 'detail.next',
        keys: ['J'],
        scope: 'detail',
        group: 'Video detail',
        label: 'Next video',
        when: onVideoPage,
        run: () => {
          const slug = currentSlug();
          if (!videos || !slug) return;
          const idx = videos.findIndex((v) => v.slug === slug);
          const next = videos[idx + 1];
          if (next) router.push(`/videos/${next.slug}`);
        },
      })
    );

    unsubs.push(
      registerShortcut({
        id: 'detail.prev',
        keys: ['K'],
        scope: 'detail',
        group: 'Video detail',
        label: 'Previous video',
        when: onVideoPage,
        run: () => {
          const slug = currentSlug();
          if (!videos || !slug) return;
          const idx = videos.findIndex((v) => v.slug === slug);
          const prev = videos[idx - 1];
          if (prev) router.push(`/videos/${prev.slug}`);
        },
      })
    );

    unsubs.push(
      registerShortcut({
        id: 'detail.metadata',
        keys: ['M'],
        scope: 'detail',
        group: 'Video detail',
        label: 'Toggle metadata panel',
        when: onVideoPage,
        run: () => ui.toggleMetadata(),
      })
    );

    unsubs.push(
      registerShortcut({
        id: 'detail.writing',
        keys: ['W'],
        scope: 'detail',
        group: 'Video detail',
        label: 'Writing mode',
        when: onVideoPage,
        run: () => ui.toggleWritingMode(),
      })
    );

    unsubs.push(
      registerShortcut({
        id: 'videos.filter.open',
        keys: ['Mod', 'Shift', 'F'],
        scope: 'list',
        group: 'Filter & sort',
        label: 'Open filter',
        when: () => ui.pathname === '/videos',
        run: () => viewStore.requestOpen('filter'),
      })
    );

    unsubs.push(
      registerShortcut({
        id: 'videos.sort.open',
        keys: ['Mod', 'Shift', 'S'],
        scope: 'list',
        group: 'Filter & sort',
        label: 'Open sort',
        when: () => ui.pathname === '/videos',
        run: () => viewStore.requestOpen('sort'),
      })
    );

    unsubs.push(
      registerShortcut({
        id: 'help.open',
        keys: ['?'],
        scope: 'global',
        group: 'Help',
        label: 'Show keyboard shortcuts',
        run: () => ui.setShortcutsOpen(!ui.shortcutsOpen),
      })
    );

    return () => {
      for (const u of unsubs) u();
    };
  }, [ui, router, videos]);

  // Global dispatcher + G-prefix chord handler.
  useEffect(() => {
    let chordTimer: ReturnType<typeof setTimeout> | null = null;
    let chordActive = false;

    const clearChord = () => {
      chordActive = false;
      if (chordTimer) {
        clearTimeout(chordTimer);
        chordTimer = null;
      }
    };

    const CHORD_ROUTES: Record<string, string> = {
      i: '/videos?v=inbox',
      v: '/videos',
      d: '/',
      h: '/hub',
    };

    const onKey = (e: KeyboardEvent) => {
      const typing = isTyping(e.target);

      // Chord second-key handler
      if (chordActive && !typing) {
        const k = e.key.toLowerCase();
        const dest = CHORD_ROUTES[k];
        if (dest && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          clearChord();
          router.push(dest);
          return;
        }
        // Any other key cancels the chord
        clearChord();
        // Fall through — let the key trigger its normal shortcut
      }

      // Chord prefix: plain `g` (no mods) outside of typing contexts
      if (
        !typing &&
        e.key.toLowerCase() === 'g' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey
      ) {
        e.preventDefault();
        chordActive = true;
        if (chordTimer) clearTimeout(chordTimer);
        chordTimer = setTimeout(clearChord, 800);
        return;
      }

      for (const def of getShortcuts()) {
        if (def.when && !def.when()) continue;
        if (!matchesShortcut(def, e)) continue;

        // When user is typing in an input/editor, only fire shortcuts that:
        //   - use a modifier (Cmd/Ctrl/Alt), OR
        //   - are Escape
        if (typing) {
          const hasMod = isMod(e) || e.altKey;
          const isEscape = e.key === 'Escape';
          if (!hasMod && !isEscape) continue;
        }

        e.preventDefault();
        def.run(e);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearChord();
    };
  }, [router]);
}
