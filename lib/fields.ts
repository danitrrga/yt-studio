import type { FieldId, FieldType, AnyOp } from './filter-types';
import { STATUS_ORDER, STATUS_LABELS } from './status';
import type { VideoSummary, VideoStatus, Audience, ContentType } from './types';

export interface FieldMeta {
  id: FieldId;
  label: string;
  type: FieldType;
  options?: (videos: VideoSummary[]) => string[];
  optionLabel?: (value: string) => string;
}

const CONTENT_TYPE: ContentType[] = ['long', 'short', 'community', 'live'];
const AUDIENCE: Audience[] = ['TOFU', 'MOFU', 'BOFU'];

const distinct = (picks: (v: VideoSummary) => string | null | undefined) =>
  (videos: VideoSummary[]) => {
    const set = new Set<string>();
    for (const v of videos) {
      const x = picks(v);
      if (x) set.add(x);
    }
    return Array.from(set).sort();
  };

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  long: 'Long-form',
  short: 'Short',
  community: 'Community',
  live: 'Live',
};

export const FIELDS: Record<FieldId, FieldMeta> = {
  title: { id: 'title', label: 'Title', type: 'text' },
  slug: { id: 'slug', label: 'Slug', type: 'text' },
  category: {
    id: 'category',
    label: 'Category',
    type: 'select',
    options: distinct((v) => v.frontmatter.category),
  },
  status: {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: () => STATUS_ORDER as string[],
    optionLabel: (v) => STATUS_LABELS[v as VideoStatus] ?? v,
  },
  audience: {
    id: 'audience',
    label: 'Audience',
    type: 'select',
    options: () => AUDIENCE as string[],
  },
  content_type: {
    id: 'content_type',
    label: 'Type',
    type: 'select',
    options: () => CONTENT_TYPE as string[],
    optionLabel: (v) => CONTENT_TYPE_LABELS[v as ContentType] ?? v,
  },
  tags: {
    id: 'tags',
    label: 'Tags',
    type: 'multi_select',
    options: (videos) => {
      const set = new Set<string>();
      for (const v of videos) for (const t of v.frontmatter.tags ?? []) set.add(t);
      return Array.from(set).sort();
    },
  },
  cycle: { id: 'cycle', label: 'Cycle', type: 'number' },
  target_date: { id: 'target_date', label: 'Plan date', type: 'date' },
  record_date: { id: 'record_date', label: 'Record date', type: 'date' },
  published_date: { id: 'published_date', label: 'Published date', type: 'date' },
  created: { id: 'created', label: 'Created', type: 'date' },
};

export const FIELD_ORDER: FieldId[] = [
  'status',
  'audience',
  'category',
  'content_type',
  'tags',
  'title',
  'target_date',
  'record_date',
  'published_date',
  'created',
  'cycle',
  'slug',
];

export const OPS_BY_TYPE: Record<FieldType, AnyOp[]> = {
  text: ['contains', 'not_contains', 'is', 'is_not', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'],
  select: ['is_any_of', 'is_none_of', 'is', 'is_not', 'is_empty', 'is_not_empty'],
  multi_select: ['contains_any_of', 'contains_all_of', 'contains_none_of', 'is_empty', 'is_not_empty'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_empty', 'is_not_empty'],
  date: ['is', 'is_before', 'is_after', 'is_on_or_before', 'is_on_or_after', 'is_within', 'is_empty', 'is_not_empty'],
  checkbox: ['is_checked', 'is_not_checked'],
};

export const OP_LABELS: Record<AnyOp, string> = {
  contains: 'contains',
  not_contains: 'does not contain',
  is: 'is',
  is_not: 'is not',
  starts_with: 'starts with',
  ends_with: 'ends with',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  is_any_of: 'is any of',
  is_none_of: 'is none of',
  contains_any_of: 'contains any of',
  contains_all_of: 'contains all of',
  contains_none_of: 'contains none of',
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  between: 'between',
  is_before: 'is before',
  is_after: 'is after',
  is_on_or_before: 'is on or before',
  is_on_or_after: 'is on or after',
  is_within: 'is within',
  is_checked: 'is checked',
  is_not_checked: 'is not checked',
};

export function opsForField(id: FieldId): AnyOp[] {
  return OPS_BY_TYPE[FIELDS[id].type];
}

export function defaultOpForField(id: FieldId): AnyOp {
  return OPS_BY_TYPE[FIELDS[id].type][0];
}

export function opNeedsValue(op: AnyOp): boolean {
  return op !== 'is_empty' && op !== 'is_not_empty' && op !== 'is_checked' && op !== 'is_not_checked';
}
