import type { HubClipSummary, HubClipStatus } from '@/lib/types';

/**
 * Resolve a clip's thumbnail to a renderable image src.
 * - empty       → null (caller renders fallback icon)
 * - http(s)://  → use directly (Web Clipper writes raw og:image URL)
 * - anything    → proxy via /api/hub/[slug]/thumbnail (server-downloaded local file)
 */
export function thumbnailSrc(clip: Pick<HubClipSummary, 'slug' | 'frontmatter'>): string | null {
  const t = clip.frontmatter.thumbnail.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `/api/hub/${clip.slug}/thumbnail`;
}

export const STATUS_LABEL: Record<HubClipStatus, string> = {
  new: 'New',
  read: 'Read',
  archived: 'Archived',
};
