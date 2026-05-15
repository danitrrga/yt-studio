import { EMPTY_FILTER, type ViewState, type ViewMode, type Condition } from './filter-types';

const KEY = 'yts:savedViews:v1';

export interface SavedView {
  id: string;
  /**
   * Stable URL slug for sidebar deep-linking (e.g. `/videos?v=in-production`).
   * Set on built-ins only — user-saved views fall through to base64 encoding.
   */
  urlKey?: string;
  name: string;
  emoji?: string;
  description?: string;
  mode: ViewMode;
  state: ViewState;
  groupBy?: GroupBy;
  createdAt: number;
  builtin?: boolean;
}

export type GroupBy = 'none' | 'status' | 'target_date' | 'record_date';

export function loadSavedViews(): SavedView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // Filter out any builtins that may have been mis-persisted in earlier versions.
    return (arr as SavedView[]).filter((v) => !v.builtin);
  } catch {}
  return [];
}

export function saveSavedViews(views: SavedView[]) {
  if (typeof window === 'undefined') return;
  try {
    // Never persist builtins.
    const persistable = views.filter((v) => !v.builtin);
    localStorage.setItem(KEY, JSON.stringify(persistable));
  } catch {}
}

export function newSavedViewId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ───── Built-in presets ─────────────────────────────────────────

function cond(
  field: Condition['field'],
  op: Condition['op'],
  value: Condition['value'] = null
): Condition {
  return {
    kind: 'cond',
    id: `builtin-${field}-${op}-${Math.random().toString(36).slice(2, 6)}`,
    field,
    op,
    value,
  };
}

function viewState(partial: Partial<ViewState>): ViewState {
  return {
    filter: EMPTY_FILTER,
    sort: [],
    search: '',
    ...partial,
  };
}

export const BUILTIN_VIEWS: SavedView[] = [
  {
    id: 'builtin-all',
    name: 'All videos',
    description: 'Everything in the pipeline',
    mode: 'table',
    state: viewState({
      sort: [{ id: 'sort-created', field: 'created', direction: 'desc' }],
      density: 'compact',
    }),
    createdAt: 0,
    builtin: true,
  },
  {
    id: 'builtin-in-production',
    urlKey: 'in-production',
    name: 'In production',
    description: 'Scripting · filming · editing',
    mode: 'kanban',
    state: viewState({
      filter: {
        kind: 'group',
        id: 'root',
        operator: 'and',
        children: [cond('status', 'is_any_of', ['scripting', 'filming', 'editing'])],
      },
    }),
    createdAt: 0,
    builtin: true,
  },
  {
    id: 'builtin-up-next',
    urlKey: 'up-next',
    name: 'Up next',
    description: 'Not published, with a record date — soonest first',
    mode: 'table',
    state: viewState({
      filter: {
        kind: 'group',
        id: 'root',
        operator: 'and',
        children: [
          cond('status', 'is_not', 'published'),
          cond('record_date', 'is_not_empty'),
        ],
      },
      sort: [{ id: 'sort-record', field: 'record_date', direction: 'asc' }],
      density: 'compact',
    }),
    createdAt: 0,
    builtin: true,
  },
  {
    id: 'builtin-published',
    name: 'Published',
    description: 'Shipped, newest first',
    mode: 'gallery',
    state: viewState({
      filter: {
        kind: 'group',
        id: 'root',
        operator: 'and',
        children: [cond('status', 'is', 'published')],
      },
      sort: [{ id: 'sort-pub', field: 'published_date', direction: 'desc' }],
    }),
    createdAt: 0,
    builtin: true,
  },
  {
    id: 'builtin-roadmap',
    urlKey: 'roadmap',
    name: 'Roadmap',
    description: 'Timeline of unpublished videos, soonest first',
    mode: 'timeline',
    state: viewState({
      filter: {
        kind: 'group',
        id: 'root',
        operator: 'and',
        children: [cond('status', 'is_not', 'published')],
      },
      sort: [{ id: 'sort-record', field: 'record_date', direction: 'asc' }],
      timelineZoom: 'month',
      timelineNoDateExpanded: false,
    }),
    createdAt: 0,
    builtin: true,
  },
];
