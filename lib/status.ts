import type { VideoStatus } from './types';

export const STATUS_ORDER: VideoStatus[] = [
  'idea',
  'research',
  'scripting',
  'filming',
  'editing',
  'published',
];

/**
 * "In flight" = research/scripting/filming/editing.
 * Excludes `idea` (not committed yet) and `published` (done).
 * Used by the home dashboard's now-working pick + Kanban WIP threshold.
 */
export const IN_FLIGHT_STATUSES: VideoStatus[] = [
  'research',
  'scripting',
  'filming',
  'editing',
];

export const STATUS_LABELS: Record<VideoStatus, string> = {
  idea: 'Idea',
  research: 'Research',
  scripting: 'Scripting',
  filming: 'Filming',
  editing: 'Editing',
  published: 'Published',
};

export const STATUS_COLOR_VAR: Record<VideoStatus, string> = {
  idea: '--status-idea',
  research: '--status-research',
  scripting: '--status-scripting',
  filming: '--status-filming',
  editing: '--status-editing',
  published: '--status-published',
};

export function statusBadgeClasses(status: VideoStatus): string {
  const v = STATUS_COLOR_VAR[status];
  return `bg-[hsl(var(${v})/0.15)] text-[hsl(var(${v}))] border-[hsl(var(${v})/0.3)]`;
}
