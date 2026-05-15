import type { VideoSummary } from './types';

const COLUMNS: { key: string; label: string; get: (v: VideoSummary) => string }[] = [
  { key: 'slug', label: 'Slug', get: (v) => v.slug },
  { key: 'title', label: 'Title', get: (v) => v.frontmatter.title ?? '' },
  { key: 'status', label: 'Status', get: (v) => v.frontmatter.status },
  { key: 'category', label: 'Category', get: (v) => v.frontmatter.category ?? '' },
  { key: 'audience', label: 'Audience', get: (v) => v.frontmatter.audience ?? '' },
  { key: 'tags', label: 'Tags', get: (v) => (v.frontmatter.tags ?? []).join('|') },
  { key: 'target_date', label: 'Plan', get: (v) => v.frontmatter.target_date ?? '' },
  { key: 'record_date', label: 'Record', get: (v) => v.frontmatter.record_date ?? '' },
  { key: 'published_date', label: 'Published', get: (v) => v.frontmatter.published_date ?? '' },
  { key: 'cycle', label: 'Cycle', get: (v) => (v.frontmatter.cycle != null ? String(v.frontmatter.cycle) : '') },
  { key: 'created', label: 'Created', get: (v) => v.frontmatter.created ?? '' },
];

function quote(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv(videos: VideoSummary[]): string {
  const header = COLUMNS.map((c) => c.label).join(',');
  const rows = videos.map((v) =>
    COLUMNS.map((c) => quote(c.get(v))).join(',')
  );
  return [header, ...rows].join('\r\n');
}

export function downloadCsv(videos: VideoSummary[], filename?: string) {
  const csv = buildCsv(videos);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().split('T')[0];
  a.download = filename ?? `videos-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
