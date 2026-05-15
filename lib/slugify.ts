/**
 * Slugify any string into the canonical kebab-case form used across the app.
 * Strips non-alphanumerics, collapses whitespace, trims edges.
 */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Slug from a URL — host + last path segment, truncated.
 * Falls back to a host-only slug if the path is uninformative.
 */
export function slugifyUrl(rawUrl: string, maxLen = 60): string {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, '').split('.')[0];
    const lastPath = u.pathname.split('/').filter(Boolean).pop() ?? '';
    const youtubeId = extractYoutubeId(rawUrl);
    const seed = youtubeId
      ? `${host}-${youtubeId}`
      : lastPath
      ? `${host}-${lastPath}`
      : host;
    return slugify(seed).slice(0, maxLen) || `clip-${Date.now()}`;
  } catch {
    return `clip-${Date.now()}`;
  }
}

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
