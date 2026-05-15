/**
 * Pure timeline axis primitive. THE single source of date↔pixel math.
 * No React, no DOM. Verifiable in isolation.
 */

import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfWeek,
  endOfWeek,
  parseISO,
} from 'date-fns';
import type { VideoSummary } from './types';

export type TimelineZoom = 'day' | 'week' | 'month' | 'quarter';

const PX_PER_DAY: Record<TimelineZoom, number> = {
  day: 72,
  week: 24,
  month: 8,
  quarter: 3,
};

export interface TimeAxis {
  zoom: TimelineZoom;
  start: Date; // inclusive
  end: Date; // exclusive
  pxPerDay: number;
  totalPx: number;
  dateToX: (d: Date | string) => number;
  xToDate: (x: number) => Date;
  ticks: TimeTick[]; // for header rendering
  monthBands: MonthBand[]; // for the upper header band
}

export interface TimeTick {
  date: Date;
  x: number;
  label: string;
  major: boolean; // major ticks get bolder header treatment
}

export interface MonthBand {
  date: Date; // first of month within visible range
  x: number;
  width: number;
  label: string;
}

function safeParse(d: Date | string): Date {
  if (d instanceof Date) return d;
  return parseISO(d);
}

function collectVideoDates(videos: VideoSummary[]): Date[] {
  const dates: Date[] = [];
  for (const v of videos) {
    if (v.frontmatter.target_date) dates.push(parseISO(v.frontmatter.target_date));
    if (v.frontmatter.record_date) dates.push(parseISO(v.frontmatter.record_date));
    if (v.frontmatter.published_date) dates.push(parseISO(v.frontmatter.published_date));
  }
  return dates;
}

function snapStart(zoom: TimelineZoom, d: Date): Date {
  switch (zoom) {
    case 'day':
      return d;
    case 'week':
      return startOfWeek(d, { weekStartsOn: 1 });
    case 'month':
      return startOfMonth(d);
    case 'quarter':
      return startOfQuarter(d);
  }
}

function snapEnd(zoom: TimelineZoom, d: Date): Date {
  switch (zoom) {
    case 'day':
      return d;
    case 'week':
      return endOfWeek(d, { weekStartsOn: 1 });
    case 'month':
      return endOfMonth(d);
    case 'quarter':
      return endOfQuarter(d);
  }
}

function paddingDays(zoom: TimelineZoom): { before: number; after: number } {
  switch (zoom) {
    case 'day':
      return { before: 7, after: 21 };
    case 'week':
      return { before: 14, after: 42 };
    case 'month':
      return { before: 30, after: 90 };
    case 'quarter':
      return { before: 30, after: 180 };
  }
}

export function buildAxis(
  zoom: TimelineZoom,
  videos: VideoSummary[],
  today: Date
): TimeAxis {
  const dates = collectVideoDates(videos);
  const earliest = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : today;
  const latest = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : today;

  const min = earliest < today ? earliest : today;
  const max = latest > today ? latest : today;

  const pad = paddingDays(zoom);
  const start = snapStart(zoom, addDays(min, -pad.before));
  const end = snapEnd(zoom, addDays(max, pad.after));

  const pxPerDay = PX_PER_DAY[zoom];
  const totalDays = differenceInCalendarDays(end, start) + 1;
  const totalPx = totalDays * pxPerDay;

  const dateToX = (d: Date | string): number => {
    const date = safeParse(d);
    return differenceInCalendarDays(date, start) * pxPerDay;
  };

  const xToDate = (x: number): Date => {
    const days = Math.round(x / pxPerDay);
    return addDays(start, days);
  };

  const ticks = buildTicks(zoom, start, end, dateToX);
  const monthBands = buildMonthBands(start, end, dateToX);

  return {
    zoom,
    start,
    end,
    pxPerDay,
    totalPx,
    dateToX,
    xToDate,
    ticks,
    monthBands,
  };
}

function buildTicks(
  zoom: TimelineZoom,
  start: Date,
  end: Date,
  dateToX: (d: Date) => number
): TimeTick[] {
  const out: TimeTick[] = [];
  const days = differenceInCalendarDays(end, start) + 1;

  if (zoom === 'day') {
    // Every day labeled; Mondays bolder.
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i);
      out.push({
        date: d,
        x: dateToX(d),
        label: format(d, 'd'),
        major: d.getDay() === 1,
      });
    }
  } else if (zoom === 'week') {
    // Even-numbered days only (2, 4, 6, …); Mondays still bolder when even.
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i);
      if (d.getDate() % 2 !== 0) continue;
      out.push({
        date: d,
        x: dateToX(d),
        label: format(d, 'd'),
        major: d.getDay() === 1,
      });
    }
  } else if (zoom === 'month') {
    // Every Monday; first Monday of month bolder.
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i);
      if (d.getDay() === 1) {
        out.push({
          date: d,
          x: dateToX(d),
          label: format(d, 'd'),
          major: d.getDate() <= 7,
        });
      }
    }
  } else {
    // Quarter: month boundaries only
    let cursor = startOfMonth(start);
    while (cursor <= end) {
      out.push({
        date: cursor,
        x: dateToX(cursor),
        label: format(cursor, 'MMM'),
        major: cursor.getMonth() % 3 === 0,
      });
      cursor = addMonths(cursor, 1);
    }
  }

  return out;
}

/**
 * Day-by-day cells used by the body for vertical gridlines + weekend tint.
 * Returned only when the zoom level is dense enough (day/week).
 */
export interface DayCell {
  date: Date;
  x: number;
  width: number;
  isWeekend: boolean;
  isMonday: boolean;
}

export function buildDayCells(axis: TimeAxis): DayCell[] {
  if (axis.zoom !== 'day' && axis.zoom !== 'week') return [];
  const out: DayCell[] = [];
  const days = differenceInCalendarDays(axis.end, axis.start) + 1;
  for (let i = 0; i < days; i++) {
    const d = addDays(axis.start, i);
    out.push({
      date: d,
      x: axis.dateToX(d),
      width: axis.pxPerDay,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isMonday: d.getDay() === 1,
    });
  }
  return out;
}

function buildMonthBands(
  start: Date,
  end: Date,
  dateToX: (d: Date) => number
): MonthBand[] {
  const out: MonthBand[] = [];
  let cursor = startOfMonth(start);
  while (cursor <= end) {
    const monthEnd = endOfMonth(cursor);
    const visibleStart = cursor < start ? start : cursor;
    const visibleEnd = monthEnd > end ? end : monthEnd;
    const x = dateToX(visibleStart);
    const w = dateToX(addDays(visibleEnd, 1)) - x;
    out.push({
      date: visibleStart,
      x,
      width: w,
      label: isSameMonth(visibleStart, new Date())
        ? format(visibleStart, 'MMMM yyyy')
        : format(visibleStart, 'MMMM'),
    });
    cursor = addMonths(cursor, 1);
  }
  return out;
}

export const ZOOM_LEVELS: TimelineZoom[] = ['day', 'week', 'month', 'quarter'];

export const ZOOM_LABEL: Record<TimelineZoom, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
};
