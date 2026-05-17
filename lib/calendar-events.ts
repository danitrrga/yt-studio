import type { VideoSummary } from './types';
import type { CalendarDateType } from './filter-types';
import { STATUS_ORDER } from './status';

export type CalendarEventKind = 'target' | 'record' | 'published';

export interface CalendarEvent {
  id: string; // `${slug}:${kind}` — used as drag id + React key
  slug: string;
  kind: CalendarEventKind;
  date: string; // YYYY-MM-DD
  video: VideoSummary;
}

const FIELD_TO_KIND: Record<CalendarDateType, CalendarEventKind> = {
  target_date: 'target',
  record_date: 'record',
  published_date: 'published',
};

const KIND_TO_FIELD: Record<CalendarEventKind, CalendarDateType> = {
  target: 'target_date',
  record: 'record_date',
  published: 'published_date',
};

export function fieldForKind(kind: CalendarEventKind): CalendarDateType {
  return KIND_TO_FIELD[kind];
}

export function flattenEvents(
  videos: VideoSummary[],
  enabled: CalendarDateType[]
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const v of videos) {
    for (const field of enabled) {
      const date = v.frontmatter[field];
      if (!date) continue;
      const iso = String(date).slice(0, 10);
      out.push({
        id: `${v.slug}:${FIELD_TO_KIND[field]}`,
        slug: v.slug,
        kind: FIELD_TO_KIND[field],
        date: iso,
        video: v,
      });
    }
  }
  return out;
}

/** Group events by YYYY-MM-DD with stable ordering: status order, then title. */
export function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = map.get(e.date) ?? [];
    list.push(e);
    map.set(e.date, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      const sa = STATUS_ORDER.indexOf(a.video.frontmatter.status);
      const sb = STATUS_ORDER.indexOf(b.video.frontmatter.status);
      if (sa !== sb) return sa - sb;
      return (a.video.frontmatter.title ?? a.slug).localeCompare(
        b.video.frontmatter.title ?? b.slug
      );
    });
  }
  return map;
}

export const KIND_LABEL: Record<CalendarEventKind, string> = {
  target: 'Plan',
  record: 'Record',
  published: 'Published',
};

/** HSL CSS color for a kind. */
export const KIND_COLOR: Record<CalendarEventKind, string> = {
  target: '240 100% 74%', // = --status-research (#7C7CFF)
  record: '38 95% 55%', // amber
  published: '145 65% 50%', // green
};

/** Resolved hex color for a kind — use instead of hsl(KIND_COLOR[kind]) in components. */
export const KIND_HEX: Record<CalendarEventKind, string> = {
  target: '#7C7CFF',
  record: '#F0A030',
  published: '#3FB984',
};
