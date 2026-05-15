import type { VideoSummary } from './types';
import type { GroupBy } from './filter-types';
import { STATUS_ORDER, STATUS_LABELS } from './status';

export interface VideoGroup {
  key: string;
  label: string;
  items: VideoSummary[];
}

function monthKey(iso: string | null): { key: string; label: string } {
  if (!iso) return { key: 'no-date', label: 'No date' };
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return { key: 'no-date', label: 'No date' };
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return { key, label };
}

export function groupVideos(videos: VideoSummary[], groupBy: GroupBy): VideoGroup[] {
  if (groupBy === 'none') {
    return [{ key: 'all', label: '', items: videos }];
  }
  const buckets = new Map<string, VideoGroup>();

  for (const v of videos) {
    let key: string;
    let label: string;
    if (groupBy === 'status') {
      key = v.frontmatter.status;
      label = STATUS_LABELS[v.frontmatter.status];
    } else {
      const field = groupBy === 'target_date' ? v.frontmatter.target_date : v.frontmatter.record_date;
      const m = monthKey(field);
      key = m.key;
      label = m.label;
    }
    const existing = buckets.get(key);
    if (existing) {
      existing.items.push(v);
    } else {
      buckets.set(key, { key, label, items: [v] });
    }
  }

  let groups = Array.from(buckets.values());
  if (groupBy === 'status') {
    groups.sort((a, b) => STATUS_ORDER.indexOf(a.key as never) - STATUS_ORDER.indexOf(b.key as never));
  } else {
    groups.sort((a, b) => {
      if (a.key === 'no-date') return 1;
      if (b.key === 'no-date') return -1;
      return a.key.localeCompare(b.key);
    });
  }
  return groups;
}
