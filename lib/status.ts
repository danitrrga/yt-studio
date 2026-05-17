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

/** Maps status → solid hex color token (use as `var(--status-X-color)`) */
export const STATUS_SOLID_VAR: Record<VideoStatus, string> = {
  idea:      '--status-idea-color',
  research:  '--status-research-color',
  scripting: '--status-scripting-color',
  filming:   '--status-filming-color',
  editing:   '--status-editing-color',
  published: '--status-published-color',
};

/** Maps status → 12% opacity tint token (use as `var(--status-X-tint)`) */
export const STATUS_TINT_VAR: Record<VideoStatus, string> = {
  idea:      '--status-idea-tint',
  research:  '--status-research-tint',
  scripting: '--status-scripting-tint',
  filming:   '--status-filming-tint',
  editing:   '--status-editing-tint',
  published: '--status-published-tint',
};

export function statusBadgeClasses(status: VideoStatus): string {
  const solid = STATUS_SOLID_VAR[status];
  const tint  = STATUS_TINT_VAR[status];
  return `bg-[var(${tint})] text-[var(${solid})] border-[var(${solid})]/30`;
}
