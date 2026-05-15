import type { ViewState, ViewMode, FilterTree, Group, Condition } from './filter-types';
import { EMPTY_FILTER, newId } from './filter-types';
import { BUILTIN_VIEWS, type SavedView } from './saved-views';

const KEY = 'yts:views:v1';

interface Persisted {
  activeView: ViewMode;
  views: Record<ViewMode, ViewState>;
}

const defaultView = (): ViewState => ({
  filter: { ...EMPTY_FILTER, children: [], id: newId() },
  sort: [],
  search: '',
});

const DEFAULT: Persisted = {
  activeView: 'table',
  views: {
    table: defaultView(),
    kanban: defaultView(),
    calendar: defaultView(),
    timeline: defaultView(),
    gallery: defaultView(),
  },
};

export function loadPersisted(): Persisted {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Persisted;
    return { ...DEFAULT, ...parsed, views: { ...DEFAULT.views, ...parsed.views } };
  } catch {
    return DEFAULT;
  }
}

export function savePersisted(state: Persisted) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export function encodeView(v: ViewState): string {
  // Preserve canonical preset identity in the URL — without this, the URL
  // writer overwrites `?v=<key>` with a base64 blob right after the preset
  // applies, and the sidebar's active tab + page title both flip back to
  // "Videos". Each preset is checked structurally against the live state.
  if (matchesInbox(v)) return INBOX_VIEW_KEY;
  for (const builtin of BUILTIN_VIEWS) {
    if (builtin.urlKey && matchesBuiltinView(v, builtin)) return builtin.urlKey;
  }
  const compact = { f: v.filter, s: v.sort, q: v.search };
  const json = JSON.stringify(compact);
  if (typeof window === 'undefined') return '';
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const INBOX_VIEW_KEY = 'inbox';

/**
 * Structural match against the inbox preset. Used by encodeView to keep the
 * URL canonical (`?v=inbox`) as long as the user hasn't diverged from the
 * preset by editing filter/sort/search.
 */
export function matchesInbox(v: ViewState): boolean {
  if (v.search !== '') return false;
  if (v.sort.length !== 1) return false;
  const s = v.sort[0];
  if (s.field !== 'created' || s.direction !== 'desc') return false;
  const f = v.filter;
  if (f.kind !== 'group' || f.operator !== 'and') return false;
  if (f.children.length !== 1) return false;
  const c = f.children[0];
  if (c.kind !== 'cond') return false;
  return c.field === 'status' && c.op === 'is' && c.value === 'idea';
}

/**
 * Strip ids + normalize a filter/sort/search slice for fingerprint comparison.
 * Builtin condition nodes carry randomly-generated ids that diverge from
 * runtime ids, so we compare by structural shape only.
 */
function normalizeNode(n: Condition | Group): unknown {
  if (n.kind === 'group') {
    return {
      kind: 'group',
      operator: n.operator,
      children: n.children.map(normalizeNode),
    };
  }
  return { kind: 'cond', field: n.field, op: n.op, value: n.value };
}

function viewFingerprint(v: ViewState): string {
  return JSON.stringify({
    filter: normalizeNode(v.filter),
    sort: v.sort.map((s) => ({ field: s.field, direction: s.direction })),
    search: v.search ?? '',
  });
}

/** Structural equality on the URL-encoded slice (filter + sort + search). */
export function matchesBuiltinView(v: ViewState, builtin: SavedView): boolean {
  return viewFingerprint(v) === viewFingerprint(builtin.state);
}

/** Look up a builtin by its URL slug. Returns null for inbox or unknown keys. */
export function getBuiltinByUrlKey(urlKey: string): SavedView | null {
  return BUILTIN_VIEWS.find((b) => b.urlKey === urlKey) ?? null;
}

export function inboxView(): ViewState {
  return {
    filter: {
      kind: 'group',
      id: 'root',
      operator: 'and',
      children: [
        {
          kind: 'cond',
          id: newId(),
          field: 'status',
          op: 'is',
          value: 'idea',
        },
      ],
    },
    sort: [{ id: newId(), field: 'created', direction: 'desc' }],
    search: '',
  };
}

export function decodeView(encoded: string): ViewState | null {
  if (encoded === INBOX_VIEW_KEY) return inboxView();
  const builtin = getBuiltinByUrlKey(encoded);
  if (builtin) return builtin.state;
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const json = decodeURIComponent(escape(atob(b64 + pad)));
    const obj = JSON.parse(json) as { f?: unknown; s?: unknown; q?: unknown };
    if (!obj || typeof obj !== 'object') return null;
    return {
      filter: (obj.f as ViewState['filter']) ?? defaultView().filter,
      sort: (obj.s as ViewState['sort']) ?? [],
      search: typeof obj.q === 'string' ? obj.q : '',
    };
  } catch {
    return null;
  }
}
