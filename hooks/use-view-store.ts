'use client';

import { useSyncExternalStore } from 'react';
import type {
  Condition,
  FilterTree,
  Group,
  SortList,
  SortRule,
  ViewMode,
  ViewState,
} from '@/lib/filter-types';
import { EMPTY_FILTER, newId } from '@/lib/filter-types';

type PerView = Record<ViewMode, ViewState>;

interface StoreState {
  activeView: ViewMode;
  views: PerView;
  pendingOpen: null | 'filter' | 'sort';
  pendingOpenId: number;
}

const defaultViewState = (): ViewState => ({
  filter: { ...EMPTY_FILTER, children: [], id: newId() },
  sort: [],
  search: '',
});

const initial: StoreState = {
  activeView: 'table',
  views: {
    table: defaultViewState(),
    kanban: defaultViewState(),
    calendar: defaultViewState(),
    timeline: defaultViewState(),
    gallery: defaultViewState(),
  },
  pendingOpen: null,
  pendingOpenId: 0,
};

let state: StoreState = initial;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function getState(): StoreState {
  return state;
}

function setActiveView(view: ViewMode) {
  if (state.activeView === view) return;
  state = { ...state, activeView: view };
  notify();
}

function updateActiveView(patch: (prev: ViewState) => ViewState) {
  const prev = state.views[state.activeView];
  const next = patch(prev);
  state = { ...state, views: { ...state.views, [state.activeView]: next } };
  notify();
}

function setSearch(search: string) {
  updateActiveView((v) => ({ ...v, search }));
}

function setFilter(filter: FilterTree) {
  updateActiveView((v) => ({ ...v, filter }));
}

function addCondition(cond: Condition) {
  updateActiveView((v) => {
    const children = [...v.filter.children, cond];
    return { ...v, filter: { ...v.filter, children } };
  });
}

function updateCondition(id: string, patch: Partial<Condition>) {
  updateActiveView((v) => ({
    ...v,
    filter: mapTree(v.filter, (n) => {
      if (n.kind === 'cond' && n.id === id) return { ...n, ...patch } as Condition;
      return n;
    }),
  }));
}

function removeCondition(id: string) {
  updateActiveView((v) => ({
    ...v,
    filter: filterTree(v.filter, (n) => !(n.kind === 'cond' && n.id === id)),
  }));
}

function clearFilters() {
  updateActiveView((v) => ({ ...v, filter: { ...v.filter, operator: 'and', children: [] } }));
}

function setSort(sort: SortList) {
  updateActiveView((v) => ({ ...v, sort }));
}

function addSort(rule: SortRule) {
  updateActiveView((v) => {
    const existing = v.sort.filter((s) => s.field !== rule.field);
    return { ...v, sort: [...existing, rule] };
  });
}

function removeSort(id: string) {
  updateActiveView((v) => ({ ...v, sort: v.sort.filter((s) => s.id !== id) }));
}

function clearSort() {
  updateActiveView((v) => ({ ...v, sort: [] }));
}

function mapTree(g: Group, fn: (n: Condition | Group) => Condition | Group): Group {
  return {
    ...g,
    children: g.children.map((c) => {
      const mapped = fn(c);
      if (mapped.kind === 'group') return mapTree(mapped, fn);
      return mapped;
    }),
  };
}

function filterTree(g: Group, keep: (n: Condition | Group) => boolean): Group {
  return {
    ...g,
    children: g.children
      .filter(keep)
      .map((c) => (c.kind === 'group' ? filterTree(c, keep) : c)),
  };
}

function hydrate(patch: Partial<StoreState>) {
  state = { ...state, ...patch, views: { ...state.views, ...(patch.views ?? {}) } };
  notify();
}

function requestOpen(which: 'filter' | 'sort') {
  state = { ...state, pendingOpen: which, pendingOpenId: state.pendingOpenId + 1 };
  notify();
}

function clearPendingOpen() {
  state = { ...state, pendingOpen: null };
  notify();
}

function setActiveViewState(view: ViewState) {
  updateActiveView(() => view);
}

function setDensity(density: ViewState['density']) {
  updateActiveView((v) => ({ ...v, density }));
}

function setGroupBy(groupBy: ViewState['groupBy']) {
  updateActiveView((v) => ({ ...v, groupBy }));
}

function setKanbanCollapsed(collapsed: string[]) {
  updateActiveView((v) => ({ ...v, kanbanCollapsed: collapsed }));
}

function setCalendarDateTypes(types: ViewState['calendarDateTypes']) {
  updateActiveView((v) => ({ ...v, calendarDateTypes: types }));
}

function setCalendarMode(mode: ViewState['calendarMode']) {
  updateActiveView((v) => ({ ...v, calendarMode: mode }));
}

function setTimelineZoom(zoom: ViewState['timelineZoom']) {
  updateActiveView((v) => ({ ...v, timelineZoom: zoom }));
}

function setTimelineNoDateExpanded(expanded: boolean) {
  updateActiveView((v) => ({ ...v, timelineNoDateExpanded: expanded }));
}

export const viewStore = {
  subscribe,
  getState,
  hydrate,
  setActiveView,
  setActiveViewState,
  setSearch,
  setFilter,
  addCondition,
  updateCondition,
  removeCondition,
  clearFilters,
  setSort,
  addSort,
  removeSort,
  clearSort,
  setDensity,
  setGroupBy,
  setKanbanCollapsed,
  setCalendarDateTypes,
  setCalendarMode,
  setTimelineZoom,
  setTimelineNoDateExpanded,
  requestOpen,
  clearPendingOpen,
};

export function usePendingOpen(which: 'filter' | 'sort'): number {
  return useViewStore((s) => (s.pendingOpen === which ? s.pendingOpenId : 0));
}

export function useViewStore<T>(selector: (s: StoreState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(initial));
}

export function useActiveView(): ViewState {
  return useViewStore((s) => s.views[s.activeView]);
}

export function useActiveViewMode(): ViewMode {
  return useViewStore((s) => s.activeView);
}

