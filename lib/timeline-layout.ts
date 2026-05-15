/**
 * Pure bar-layout primitive. Maps a video to its visual bar (or point)
 * given a TimeAxis. Verifiable in isolation.
 */

import { addDays, format, parseISO } from 'date-fns';
import type { VideoSummary } from './types';
import type { TimeAxis } from './timeline-axis';

export type BarKind = 'point' | 'span';
export type DateKind = 'target' | 'record' | 'published';

export interface BarMarker {
  kind: DateKind;
  date: string; // YYYY-MM-DD
  offsetX: number; // px from bar left
  absX: number; // px from axis start
  /** True for placeholder dots representing unset dates. */
  placeholder?: boolean;
}

const ALL_KINDS: DateKind[] = ['target', 'record', 'published'];

export interface BarLayout {
  slug: string;
  kind: BarKind;
  startDate: string;
  endDate: string;
  left: number;
  width: number;
  markers: BarMarker[];
}

const POINT_WIDTH_PX = 12;

function setDates(v: VideoSummary): { kind: DateKind; date: string }[] {
  const out: { kind: DateKind; date: string }[] = [];
  if (v.frontmatter.target_date) out.push({ kind: 'target', date: v.frontmatter.target_date });
  if (v.frontmatter.record_date) out.push({ kind: 'record', date: v.frontmatter.record_date });
  if (v.frontmatter.published_date) out.push({ kind: 'published', date: v.frontmatter.published_date });
  return out;
}

export function partitionVideos(videos: VideoSummary[]): {
  dated: VideoSummary[];
  undated: VideoSummary[];
} {
  const dated: VideoSummary[] = [];
  const undated: VideoSummary[] = [];
  for (const v of videos) {
    if (setDates(v).length === 0) undated.push(v);
    else dated.push(v);
  }
  return { dated, undated };
}

export function layoutBar(video: VideoSummary, axis: TimeAxis): BarLayout | null {
  const dates = setDates(video);
  if (dates.length === 0) return null;

  // Sort by date ascending
  const sorted = [...dates].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = sorted[0].date;
  const endDate = sorted[sorted.length - 1].date;
  const isPoint = startDate === endDate;

  const startX = axis.dateToX(startDate);
  const endX = axis.dateToX(endDate);

  let left: number;
  let width: number;

  if (isPoint) {
    left = startX - POINT_WIDTH_PX / 2;
    width = POINT_WIDTH_PX;
  } else {
    // Bar spans from the start marker's center to the end marker's center.
    // The dots themselves visually anchor each end of the bar.
    left = startX;
    width = Math.max(POINT_WIDTH_PX, endX - startX);
  }

  const markers: BarMarker[] = sorted.map((d) => {
    const absX = axis.dateToX(d.date);
    return {
      kind: d.kind,
      date: d.date,
      absX,
      offsetX: absX - left,
    };
  });

  // Placeholder markers for unset date kinds — stacked just after the bar's
  // end so the user can grab them and drag onto a day to set that date.
  const setKindSet = new Set(sorted.map((d) => d.kind));
  const missing = ALL_KINDS.filter((k) => !setKindSet.has(k));
  const PLACEHOLDER_GAP_DAYS = 2;
  missing.forEach((kind, i) => {
    const placeholderDate = format(
      addDays(parseISO(endDate), PLACEHOLDER_GAP_DAYS * (i + 1)),
      'yyyy-MM-dd'
    );
    const absX = axis.dateToX(placeholderDate);
    markers.push({
      kind,
      date: placeholderDate,
      absX,
      offsetX: absX - left,
      placeholder: true,
    });
  });

  return {
    slug: video.slug,
    kind: isPoint ? 'point' : 'span',
    startDate,
    endDate,
    left,
    width,
    markers,
  };
}
