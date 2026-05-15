import type {
  AnyOp,
  Condition,
  DateRelative,
  FilterTree,
  Group,
} from './filter-types';
import { FIELDS } from './fields';
import type { VideoSummary } from './types';

function readField(v: VideoSummary, field: Condition['field']): unknown {
  const f = v.frontmatter;
  switch (field) {
    case 'slug': return v.slug;
    case 'title': return f.title;
    case 'category': return f.category;
    case 'status': return f.status;
    case 'audience': return f.audience;
    case 'content_type': return f.content_type ?? 'long';
    case 'tags': return f.tags ?? [];
    case 'cycle': return f.cycle ?? null;
    case 'target_date': return f.target_date;
    case 'record_date': return f.record_date;
    case 'published_date': return f.published_date;
    case 'created': return f.created;
    default: return null;
  }
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function evalText(fv: unknown, op: AnyOp, cv: unknown): boolean {
  const s = typeof fv === 'string' ? fv.toLowerCase() : '';
  const q = typeof cv === 'string' ? cv.toLowerCase() : '';
  switch (op) {
    case 'contains': return s.includes(q);
    case 'not_contains': return !s.includes(q);
    case 'is': return s === q;
    case 'is_not': return s !== q;
    case 'starts_with': return s.startsWith(q);
    case 'ends_with': return s.endsWith(q);
    case 'is_empty': return isEmpty(fv);
    case 'is_not_empty': return !isEmpty(fv);
  }
  return false;
}

function evalSelect(fv: unknown, op: AnyOp, cv: unknown): boolean {
  const s = fv == null ? '' : String(fv);
  switch (op) {
    case 'is': return s === cv;
    case 'is_not': return s !== cv;
    case 'is_any_of': return Array.isArray(cv) && cv.length > 0 && cv.includes(s);
    case 'is_none_of': return Array.isArray(cv) && cv.length > 0 && !cv.includes(s);
    case 'is_empty': return isEmpty(fv);
    case 'is_not_empty': return !isEmpty(fv);
  }
  return false;
}

function evalMultiSelect(fv: unknown, op: AnyOp, cv: unknown): boolean {
  const arr = Array.isArray(fv) ? (fv as string[]) : [];
  const targets = Array.isArray(cv) ? (cv as string[]) : [];
  switch (op) {
    case 'contains_any_of': return targets.length > 0 && targets.some((t) => arr.includes(t));
    case 'contains_all_of': return targets.length > 0 && targets.every((t) => arr.includes(t));
    case 'contains_none_of': return targets.length > 0 && targets.every((t) => !arr.includes(t));
    case 'is_empty': return arr.length === 0;
    case 'is_not_empty': return arr.length > 0;
  }
  return false;
}

function evalNumber(fv: unknown, op: AnyOp, cv: unknown): boolean {
  if (op === 'is_empty') return fv == null;
  if (op === 'is_not_empty') return fv != null;
  if (fv == null) return false;
  const n = Number(fv);
  if (op === 'between') {
    if (!Array.isArray(cv) || cv.length !== 2) return false;
    const [min, max] = cv as [number, number];
    return n >= min && n <= max;
  }
  const x = Number(cv);
  if (Number.isNaN(x)) return false;
  switch (op) {
    case 'eq': return n === x;
    case 'neq': return n !== x;
    case 'gt': return n > x;
    case 'gte': return n >= x;
    case 'lt': return n < x;
    case 'lte': return n <= x;
  }
  return false;
}

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }

function relativeRange(key: DateRelative): { from: Date; to: Date } {
  const now = startOfDay(new Date());
  const day = 86400000;
  const weekDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const monday = new Date(now.getTime() - weekDay * day);
  const sunday = new Date(monday.getTime() + 6 * day);
  switch (key) {
    case 'today': return { from: now, to: new Date(now.getTime() + day - 1) };
    case 'yesterday': {
      const y = new Date(now.getTime() - day);
      return { from: y, to: new Date(y.getTime() + day - 1) };
    }
    case 'this_week': return { from: monday, to: new Date(sunday.getTime() + day - 1) };
    case 'past_week': return { from: new Date(now.getTime() - 7 * day), to: now };
    case 'past_month': return { from: new Date(now.getTime() - 30 * day), to: now };
    case 'next_week': return { from: now, to: new Date(now.getTime() + 7 * day) };
    case 'next_month': return { from: now, to: new Date(now.getTime() + 30 * day) };
  }
}

function evalDate(fv: unknown, op: AnyOp, cv: unknown): boolean {
  if (op === 'is_empty') return isEmpty(fv);
  if (op === 'is_not_empty') return !isEmpty(fv);
  if (fv == null || typeof fv !== 'string') return false;
  const fd = new Date(fv);
  if (Number.isNaN(fd.getTime())) return false;
  if (op === 'is_within') {
    const { from, to } = relativeRange(cv as DateRelative);
    return fd >= from && fd <= to;
  }
  if (typeof cv !== 'string') return false;
  const cd = new Date(cv);
  if (Number.isNaN(cd.getTime())) return false;
  const fday = startOfDay(fd).getTime();
  const cday = startOfDay(cd).getTime();
  switch (op) {
    case 'is': return fday === cday;
    case 'is_before': return fday < cday;
    case 'is_after': return fday > cday;
    case 'is_on_or_before': return fday <= cday;
    case 'is_on_or_after': return fday >= cday;
  }
  return false;
}

function evalCheckbox(fv: unknown, op: AnyOp): boolean {
  const checked = fv === true;
  if (op === 'is_checked') return checked;
  if (op === 'is_not_checked') return !checked;
  return false;
}

function evalCondition(c: Condition, v: VideoSummary): boolean {
  const fv = readField(v, c.field);
  const type = FIELDS[c.field].type;
  switch (type) {
    case 'text': return evalText(fv, c.op, c.value);
    case 'select': return evalSelect(fv, c.op, c.value);
    case 'multi_select': return evalMultiSelect(fv, c.op, c.value);
    case 'number': return evalNumber(fv, c.op, c.value);
    case 'date': return evalDate(fv, c.op, c.value);
    case 'checkbox': return evalCheckbox(fv, c.op);
  }
}

function evalGroup(g: Group, v: VideoSummary): boolean {
  if (g.children.length === 0) return true;
  if (g.operator === 'and') {
    for (const child of g.children) if (!evalNode(child, v)) return false;
    return true;
  }
  for (const child of g.children) if (evalNode(child, v)) return true;
  return false;
}

function evalNode(n: Condition | Group, v: VideoSummary): boolean {
  return n.kind === 'cond' ? evalCondition(n, v) : evalGroup(n, v);
}

export function applyFilter(
  videos: VideoSummary[],
  tree: FilterTree,
  search: string
): VideoSummary[] {
  const q = search.trim().toLowerCase();
  return videos.filter((v) => {
    if (!evalGroup(tree, v)) return false;
    if (q) {
      const tags = (v.frontmatter.tags ?? []).join(' ');
      const hay = `${v.frontmatter.title} ${v.frontmatter.category} ${tags}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
