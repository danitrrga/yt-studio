'use client';

import type { VideoStatus, VideoSummary } from './types';

/** Default within-column sort: target_date asc, nulls last, then title. */
function sortKanbanColumn(items: VideoSummary[]): VideoSummary[] {
  return [...items].sort((a, b) => {
    const ad = a.frontmatter.target_date;
    const bd = b.frontmatter.target_date;
    if (ad && bd) return ad.localeCompare(bd);
    if (ad && !bd) return -1;
    if (!ad && bd) return 1;
    return (a.frontmatter.title ?? a.slug).localeCompare(b.frontmatter.title ?? b.slug);
  });
}

const KEY = 'yts:kanbanOrder:v1';

type OrderMap = Record<VideoStatus, string[]>;

function emptyOrder(): OrderMap {
  return {
    idea: [],
    research: [],
    scripting: [],
    filming: [],
    editing: [],
    published: [],
  };
}

function load(): OrderMap {
  if (typeof window === 'undefined') return emptyOrder();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyOrder();
    const parsed = JSON.parse(raw);
    return { ...emptyOrder(), ...parsed };
  } catch {
    return emptyOrder();
  }
}

function save(order: OrderMap) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(order)); } catch {}
}

/**
 * Order videos within a column. Honors persisted order; falls back to
 * target_date sort for any slugs not yet in the persisted list (placed
 * at the end in their derived order).
 */
export function orderColumn(status: VideoStatus, videos: VideoSummary[]): VideoSummary[] {
  const order = load()[status] ?? [];
  const known = new Set(order);
  const bySlug = new Map(videos.map((v) => [v.slug, v]));

  const ordered: VideoSummary[] = [];
  for (const slug of order) {
    const v = bySlug.get(slug);
    if (v) ordered.push(v);
  }
  const newcomers = videos.filter((v) => !known.has(v.slug));
  const sortedNew = sortKanbanColumn(newcomers);
  return [...ordered, ...sortedNew];
}

/** Persist a column's full new ordering. */
export function setColumnOrder(status: VideoStatus, slugs: string[]) {
  const order = load();
  order[status] = slugs;
  save(order);
}

/** Remove a slug from a column's persisted order (e.g. on cross-column move). */
export function removeFromColumn(status: VideoStatus, slug: string) {
  const order = load();
  order[status] = (order[status] ?? []).filter((s) => s !== slug);
  save(order);
}

/** Insert a slug into a column at a position (defaults to end). */
export function insertIntoColumn(status: VideoStatus, slug: string, atIndex?: number) {
  const order = load();
  const list = (order[status] ?? []).filter((s) => s !== slug);
  const idx = atIndex == null ? list.length : Math.max(0, Math.min(atIndex, list.length));
  list.splice(idx, 0, slug);
  order[status] = list;
  save(order);
}
