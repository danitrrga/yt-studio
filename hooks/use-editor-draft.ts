'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { toast } from 'sonner';
import { useVideo, updateVideoBody } from './use-videos';
import { loadDraft, saveDraft, clearDraft } from '@/lib/draft-storage';
import { threeWayMerge, type ConflictHunk } from '@/lib/three-way-merge';
import { recordEvent } from '@/lib/telemetry';

export type DraftStatus = 'clean' | 'dirty' | 'saving' | 'error' | 'conflict';

export interface PendingExternal {
  body: string;
  mtime: number;
  conflictHunks: ConflictHunk[];
}

interface State {
  draft: string;
  baseline: string;
  status: DraftStatus;
  revisionToken: number;
  serverMtime: number;
  errorMessage: string | null;
  initialized: boolean;
  pendingExternal: PendingExternal | null;
}

type Action =
  | { type: 'init'; body: string; mtime: number }
  | { type: 'setDraft'; value: string }
  | { type: 'startSave' }
  | { type: 'saveOk'; savedValue: string; mtime: number }
  | { type: 'saveErr'; message: string }
  | { type: 'adoptServer'; body: string; mtime: number }
  | { type: 'autoMerged'; mergedDraft: string; serverBody: string; mtime: number }
  | { type: 'mergeConflict'; serverBody: string; mtime: number; conflictHunks: ConflictHunk[] }
  | { type: 'keepDraft'; serverBody: string; mtime: number }
  | { type: 'dismissExternal' };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'init':
      return {
        draft: a.body,
        baseline: a.body,
        status: 'clean',
        revisionToken: s.revisionToken + 1,
        serverMtime: a.mtime,
        errorMessage: null,
        initialized: true,
        pendingExternal: null,
      };
    case 'setDraft': {
      if (a.value === s.draft) return s;
      const dirty = a.value !== s.baseline;
      return {
        ...s,
        draft: a.value,
        status: s.status === 'saving' ? 'saving' : dirty ? 'dirty' : 'clean',
      };
    }
    case 'startSave':
      return { ...s, status: 'saving', errorMessage: null };
    case 'saveOk': {
      const isStillDirty = s.draft !== a.savedValue;
      return {
        ...s,
        baseline: a.savedValue,
        serverMtime: a.mtime,
        status: isStillDirty ? 'dirty' : 'clean',
      };
    }
    case 'saveErr':
      return { ...s, status: 'error', errorMessage: a.message };
    case 'adoptServer':
      return {
        ...s,
        draft: a.body,
        baseline: a.body,
        status: 'clean',
        serverMtime: a.mtime,
        errorMessage: null,
        revisionToken: s.revisionToken + 1,
        pendingExternal: null,
      };
    case 'autoMerged':
      // Non-overlapping merge succeeded; merged body becomes the new draft,
      // baseline advances to the server snapshot. Save scheduler will commit.
      return {
        ...s,
        draft: a.mergedDraft,
        baseline: a.serverBody,
        serverMtime: a.mtime,
        status: 'dirty',
        revisionToken: s.revisionToken + 1,
        pendingExternal: null,
      };
    case 'mergeConflict':
      return {
        ...s,
        status: 'conflict',
        serverMtime: a.mtime,
        pendingExternal: {
          body: a.serverBody,
          mtime: a.mtime,
          conflictHunks: a.conflictHunks,
        },
      };
    case 'keepDraft':
      return {
        ...s,
        baseline: a.serverBody,
        serverMtime: a.mtime,
        status: 'dirty',
        pendingExternal: null,
      };
    case 'dismissExternal':
      return { ...s, pendingExternal: null };
    default:
      return s;
  }
}

const initial: State = {
  draft: '',
  baseline: '',
  status: 'clean',
  revisionToken: 0,
  serverMtime: 0,
  errorMessage: null,
  initialized: false,
  pendingExternal: null,
};

export function useEditorDraft(slug: string) {
  const { video, mutate } = useVideo(slug);
  const [state, dispatch] = useReducer(reducer, initial);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  // Synchronous tracker of known-to-us server mtimes; avoids race between
  // dispatch(saveOk) and the next SWR revalidation
  const knownMtimesRef = useRef<Set<number>>(new Set());

  // init on first server body for this slug — also replay stored draft if newer
  useEffect(() => {
    if (!video) return;
    if (state.initialized) return;
    knownMtimesRef.current.add(video.mtime);
    (async () => {
      const stored = await loadDraft(video.slug);
      dispatch({ type: 'init', body: video.body, mtime: video.mtime });
      if (
        stored &&
        stored.body !== video.body &&
        stored.body.trim() !== video.body.trim() &&
        stored.baselineMtime <= video.mtime
      ) {
        // Stored draft is newer than last save and differs from server.
        // Restore by treating it as local edit.
        dispatch({ type: 'setDraft', value: stored.body });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.slug, video?.body]);

  // Persist draft to IndexedDB whenever it drifts from baseline
  useEffect(() => {
    if (!state.initialized || !slug) return;
    if (state.draft === state.baseline) {
      // Clean — remove any stale stored draft
      clearDraft(slug);
      return;
    }
    saveDraft(slug, {
      body: state.draft,
      baselineMtime: state.serverMtime,
      savedAt: Date.now(),
    });
  }, [slug, state.draft, state.baseline, state.initialized, state.serverMtime]);

  // reset when slug changes
  useEffect(() => {
    if (slug && state.initialized && video && video.slug !== slug) {
      // defensive; should not happen because useVideo keys on slug
    }
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [slug, state.initialized, video]);

  // detect server-side change
  useEffect(() => {
    if (!video || !state.initialized) return;
    // Ignore our own saves: mtime we've seen from our own PUT responses.
    // Refs > state for race-safety between dispatch(saveOk) and SWR revalidation.
    if (knownMtimesRef.current.has(video.mtime)) return;
    if (video.mtime === state.serverMtime) return;
    // Trim-normalize comparison — ignore trailing whitespace drift from gray-matter
    const normalizedServer = video.body.trim();
    const normalizedBaseline = state.baseline.trim();
    if (normalizedServer === normalizedBaseline) return;
    // Server has genuinely new content vs what we last synced.
    if (state.draft.trim() === normalizedBaseline) {
      // local clean → auto-adopt
      dispatch({ type: 'adoptServer', body: video.body, mtime: video.mtime });
    } else {
      // local dirty → attempt 3-way merge.
      if (state.status === 'conflict') return;
      const merge = threeWayMerge(state.baseline, state.draft, video.body);
      if (merge.ok) {
        dispatch({
          type: 'autoMerged',
          mergedDraft: merge.merged,
          serverBody: video.body,
          mtime: video.mtime,
        });
        const lineCount = merge.merged.split('\n').length - state.draft.split('\n').length;
        toast.success('Merged external change', {
          description:
            lineCount > 0 ? `+${lineCount} lines pulled in from disk` : 'Disk edits merged',
          duration: 4000,
        });
        recordEvent({
          scope: 'editor',
          event: 'merge.auto',
          level: 'info',
          slug,
          payload: { addedLines: lineCount },
        });
      } else {
        dispatch({
          type: 'mergeConflict',
          serverBody: video.body,
          mtime: video.mtime,
          conflictHunks: merge.conflictHunks,
        });
        recordEvent({
          scope: 'editor',
          event: 'merge.conflict',
          level: 'warn',
          slug,
          payload: { hunkCount: merge.conflictHunks.length },
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.body, video?.mtime, state.initialized, state.baseline, state.draft, state.serverMtime, state.status]);

  const performSave = useCallback(
    async (value: string) => {
      dispatch({ type: 'startSave' });
      const t0 = performance.now();
      try {
        const res = await updateVideoBody(slug, value);
        const mtime = (res && typeof res === 'object' && 'mtime' in res ? (res as { mtime: number }).mtime : Date.now()) as number;
        knownMtimesRef.current.add(mtime);
        // Cap the set at 16 recent mtimes to prevent unbounded growth
        if (knownMtimesRef.current.size > 16) {
          const arr = Array.from(knownMtimesRef.current);
          knownMtimesRef.current = new Set(arr.slice(-16));
        }
        dispatch({ type: 'saveOk', savedValue: value, mtime });
        recordEvent({
          scope: 'editor',
          event: 'save.ok',
          level: 'info',
          slug,
          durationMs: Math.round(performance.now() - t0),
        });
        mutate();
        // If user kept typing during save, schedule follow-up
        const latest = stateRef.current.draft;
        if (latest !== value) {
          schedule(latest);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Save failed';
        dispatch({ type: 'saveErr', message });
        recordEvent({
          scope: 'editor',
          event: 'save.failed',
          level: 'error',
          slug,
          durationMs: Math.round(performance.now() - t0),
          payload: { error: message },
        });
      }
    },
    [slug, mutate]
  );

  const schedule = useCallback(
    (value: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      pendingSaveRef.current = value;
      saveTimer.current = setTimeout(() => {
        const latest = stateRef.current.draft;
        if (latest !== stateRef.current.baseline && stateRef.current.status !== 'conflict') {
          performSave(latest);
        }
      }, 600);
    },
    [performSave]
  );

  const setDraft = useCallback(
    (value: string) => {
      dispatch({ type: 'setDraft', value });
      if (stateRef.current.status !== 'conflict') {
        schedule(value);
      }
    },
    [schedule]
  );

  const forceSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const v = stateRef.current.draft;
    if (v !== stateRef.current.baseline) performSave(v);
  }, [performSave]);

  const adoptServer = useCallback(() => {
    if (!video) return;
    dispatch({ type: 'adoptServer', body: video.body, mtime: video.mtime });
  }, [video]);

  const keepDraft = useCallback(() => {
    if (!video) return;
    dispatch({ type: 'keepDraft', serverBody: video.body, mtime: video.mtime });
    // schedule save to overwrite server
    schedule(stateRef.current.draft);
  }, [video, schedule]);

  const dismissExternal = useCallback(() => {
    dispatch({ type: 'dismissExternal' });
  }, []);

  // beforeunload guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state.status === 'dirty' || state.status === 'saving' || state.status === 'error') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.status]);

  return {
    draft: state.draft,
    baseline: state.baseline,
    status: state.status,
    errorMessage: state.errorMessage,
    revisionToken: state.revisionToken,
    initialized: state.initialized,
    pendingExternal: state.pendingExternal,
    setDraft,
    forceSave,
    adoptServer,
    keepDraft,
    dismissExternal,
  };
}
