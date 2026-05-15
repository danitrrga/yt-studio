/**
 * Pure drag-delta math. Returns a frontmatter patch that shifts every
 * SET date on the video by the same number of days. Null fields stay null.
 */

import { addDays, format, parseISO } from 'date-fns';
import type { VideoSummary } from './types';

export interface DateShift {
  target_date?: string | null;
  record_date?: string | null;
  published_date?: string | null;
}

function shiftIso(iso: string | null, deltaDays: number): string | null {
  if (!iso) return null;
  const d = parseISO(iso);
  return format(addDays(d, deltaDays), 'yyyy-MM-dd');
}

/**
 * Returns the patch to apply via updateVideoField. Only includes keys that
 * were originally set; unset dates are left untouched (not nulled).
 */
export function applyDelta(video: VideoSummary, deltaDays: number): DateShift {
  if (deltaDays === 0) return {};
  const out: DateShift = {};
  const fm = video.frontmatter;
  if (fm.target_date) out.target_date = shiftIso(fm.target_date, deltaDays);
  if (fm.record_date) out.record_date = shiftIso(fm.record_date, deltaDays);
  if (fm.published_date) out.published_date = shiftIso(fm.published_date, deltaDays);
  return out;
}

/** Inverse patch — restore original dates (used by Undo). */
export function originalDates(video: VideoSummary): DateShift {
  return {
    target_date: video.frontmatter.target_date ?? null,
    record_date: video.frontmatter.record_date ?? null,
    published_date: video.frontmatter.published_date ?? null,
  };
}
