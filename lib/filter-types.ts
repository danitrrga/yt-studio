export type FieldId =
  | 'title'
  | 'category'
  | 'slug'
  | 'status'
  | 'audience'
  | 'content_type'
  | 'tags'
  | 'target_date'
  | 'record_date'
  | 'published_date'
  | 'created'
  | 'cycle';

export type FieldType =
  | 'text'
  | 'select'
  | 'multi_select'
  | 'number'
  | 'date'
  | 'checkbox';

export type TextOp =
  | 'contains'
  | 'not_contains'
  | 'is'
  | 'is_not'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty';

export type SelectOp =
  | 'is'
  | 'is_not'
  | 'is_any_of'
  | 'is_none_of'
  | 'is_empty'
  | 'is_not_empty';

export type MultiSelectOp =
  | 'contains_any_of'
  | 'contains_all_of'
  | 'contains_none_of'
  | 'is_empty'
  | 'is_not_empty';

export type NumberOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'is_empty'
  | 'is_not_empty';

export type DateRelative =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'past_week'
  | 'past_month'
  | 'next_week'
  | 'next_month';

export type DateOp =
  | 'is'
  | 'is_before'
  | 'is_after'
  | 'is_on_or_before'
  | 'is_on_or_after'
  | 'is_within'
  | 'is_empty'
  | 'is_not_empty';

export type CheckboxOp = 'is_checked' | 'is_not_checked';

export type AnyOp =
  | TextOp
  | SelectOp
  | MultiSelectOp
  | NumberOp
  | DateOp
  | CheckboxOp;

export type FilterValue =
  | string
  | string[]
  | number
  | [number, number]
  | DateRelative
  | null;

export interface Condition {
  kind: 'cond';
  id: string;
  field: FieldId;
  op: AnyOp;
  value: FilterValue;
}

export interface Group {
  kind: 'group';
  id: string;
  operator: 'and' | 'or';
  children: Array<Condition | Group>;
}

export type FilterTree = Group;

export interface SortRule {
  id: string;
  field: FieldId;
  direction: 'asc' | 'desc';
}

export type SortList = SortRule[];

export type ViewMode = 'table' | 'kanban' | 'calendar' | 'timeline' | 'gallery';

export type Density = 'compact' | 'regular' | 'comfortable';

export type GroupBy = 'none' | 'status' | 'target_date' | 'record_date';

export type CalendarDateType = 'target_date' | 'record_date' | 'published_date';
export type CalendarMode = 'month' | 'week';

export type TimelineZoom = 'day' | 'week' | 'month' | 'quarter';

export interface ViewState {
  filter: FilterTree;
  sort: SortList;
  search: string;
  density?: Density;
  groupBy?: GroupBy;
  kanbanCollapsed?: string[];
  calendarDateTypes?: CalendarDateType[];
  calendarMode?: CalendarMode;
  timelineZoom?: TimelineZoom;
  timelineNoDateExpanded?: boolean;
}

export const EMPTY_FILTER: FilterTree = {
  kind: 'group',
  id: 'root',
  operator: 'and',
  children: [],
};

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function hasAnyConditions(tree: FilterTree): boolean {
  return tree.children.length > 0;
}
