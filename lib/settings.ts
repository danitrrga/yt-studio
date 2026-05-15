/**
 * User settings — persisted to localStorage. Single-user app, no server sync.
 *
 * Keep this small: every setting here loads on every editor mount, so don't
 * promote runtime preferences to a setting unless the user demonstrably
 * needs to change them.
 */

const STORAGE_KEY = 'yts:settings:v1';

export type TabWidth = 2 | 4 | 8;
export type BodyFontSize = 13 | 14 | 15;
export type DefaultViewMode = 'table' | 'kanban' | 'gallery' | 'calendar' | 'timeline';
export type DefaultDensity = 'compact' | 'regular' | 'comfortable';
export type DefaultLanding = '/' | '/videos' | '/hub';
export type NowWorkingRule = 'soonest_target' | 'soonest_record' | 'latest_edited';
export type DateFormat = 'relative' | 'absolute' | 'both';

export interface UserSettings {
  /** Number of spaces inserted on Tab keypress in the editor. */
  tabWidth: TabWidth;
  /** Body font size for the script editor (px). */
  bodyFontSize: BodyFontSize;
  /** Words-per-minute used to estimate spoken duration. */
  wordsPerMinute: number;
  /** Default view mode when first opening /videos. */
  defaultViewMode: DefaultViewMode;
  /** Default density across views. */
  defaultDensity: DefaultDensity;
  /** Page the user lands on when opening the app at /. */
  defaultLanding: DefaultLanding;
  /** Rule used to auto-pick the "Now working on" video on Today's Focus. */
  nowWorkingRule: NowWorkingRule;
  /** How dates render across the app. */
  dateFormat: DateFormat;
}

export const DEFAULT_SETTINGS: UserSettings = {
  tabWidth: 2,
  bodyFontSize: 13,
  wordsPerMinute: 150,
  defaultViewMode: 'table',
  defaultDensity: 'compact',
  defaultLanding: '/',
  nowWorkingRule: 'soonest_target',
  dateFormat: 'relative',
};

const TAB_WIDTHS = [2, 4, 8] as const;
const BODY_FONT_SIZES = [13, 14, 15] as const;
const VIEW_MODES = ['table', 'kanban', 'gallery', 'calendar', 'timeline'] as const;
const DENSITIES = ['compact', 'regular', 'comfortable'] as const;
const LANDINGS = ['/', '/videos', '/hub'] as const;
const NW_RULES = ['soonest_target', 'soonest_record', 'latest_edited'] as const;
const DATE_FORMATS = ['relative', 'absolute', 'both'] as const;

function pick<T extends string | number>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

export function readSettings(): UserSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const p = JSON.parse(raw) as Partial<UserSettings>;
    return {
      tabWidth: pick(p.tabWidth, TAB_WIDTHS, DEFAULT_SETTINGS.tabWidth),
      bodyFontSize: pick(p.bodyFontSize, BODY_FONT_SIZES, DEFAULT_SETTINGS.bodyFontSize),
      wordsPerMinute:
        typeof p.wordsPerMinute === 'number' && p.wordsPerMinute >= 60 && p.wordsPerMinute <= 240
          ? p.wordsPerMinute
          : DEFAULT_SETTINGS.wordsPerMinute,
      defaultViewMode: pick(p.defaultViewMode, VIEW_MODES, DEFAULT_SETTINGS.defaultViewMode),
      defaultDensity: pick(p.defaultDensity, DENSITIES, DEFAULT_SETTINGS.defaultDensity),
      defaultLanding: pick(p.defaultLanding, LANDINGS, DEFAULT_SETTINGS.defaultLanding),
      nowWorkingRule: pick(p.nowWorkingRule, NW_RULES, DEFAULT_SETTINGS.nowWorkingRule),
      dateFormat: pick(p.dateFormat, DATE_FORMATS, DEFAULT_SETTINGS.dateFormat),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(s: UserSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent('yts:settings:changed', { detail: s }));
  } catch {
    // ignore quota / private mode failures
  }
}

export function indentString(width: number): string {
  return ' '.repeat(width);
}
