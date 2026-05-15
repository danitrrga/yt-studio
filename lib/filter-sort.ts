import type { FieldId, SortList } from './filter-types';
import type { VideoSummary } from './types';

function readSortField(v: VideoSummary, field: FieldId): unknown {
  const f = v.frontmatter;
  switch (field) {
    case 'slug': return v.slug;
    case 'title': return f.title?.toLowerCase() ?? '';
    case 'category': return f.category?.toLowerCase() ?? '';
    case 'status': return f.status;
    case 'audience': return f.audience;
    case 'content_type': return f.content_type ?? 'long';
    case 'tags': return (f.tags ?? []).join(',');
    case 'cycle': return f.cycle ?? null;
    case 'target_date': return f.target_date ? new Date(f.target_date).getTime() : null;
    case 'record_date': return f.record_date ? new Date(f.record_date).getTime() : null;
    case 'published_date': return f.published_date ? new Date(f.published_date).getTime() : null;
    case 'created': return f.created ? new Date(f.created).getTime() : null;
    default: return null;
  }
}

function cmp(a: unknown, b: unknown): number {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

export function applySort(videos: VideoSummary[], rules: SortList): VideoSummary[] {
  if (rules.length === 0) return videos;
  const out = videos.slice();
  out.sort((a, b) => {
    for (const r of rules) {
      const av = readSortField(a, r.field);
      const bv = readSortField(b, r.field);
      const c = cmp(av, bv);
      if (c !== 0) return r.direction === 'asc' ? c : -c;
    }
    return 0;
  });
  return out;
}
