/**
 * Server-side URL metadata fetcher.
 * Returns title, description, image URL, and detected source for any URL.
 * Best-effort: returns empty strings on failure rather than throwing.
 */

import type { HubSource } from './types';

export interface UrlMeta {
  title: string;
  description: string;
  image: string; // absolute URL
  source: HubSource;
}

const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 256 * 1024;

export function detectSource(rawUrl: string): HubSource {
  try {
    const host = new URL(rawUrl).hostname.replace(/^www\./, '');
    if (/^(youtube\.com|youtu\.be|m\.youtube\.com)$/.test(host)) return 'youtube';
    if (/^(twitter\.com|x\.com)$/.test(host)) return 'tweet';
    if (host.endsWith('.rss') || host.includes('feeds.')) return 'article';
    if (/podcast|spotify\.com\/episode|apple\.com\/.*\/podcast/.test(rawUrl)) return 'podcast';
    return 'article';
  } catch {
    return 'other';
  }
}

export async function fetchUrlMeta(rawUrl: string): Promise<UrlMeta> {
  const source = detectSource(rawUrl);
  if (source === 'youtube') {
    const yt = await fetchYouTubeOembed(rawUrl);
    if (yt) return { ...yt, source };
  }
  const generic = await fetchGenericMeta(rawUrl);
  return { ...generic, source };
}

async function fetchYouTubeOembed(rawUrl: string): Promise<Omit<UrlMeta, 'source'> | null> {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(endpoint, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      title: data.title ?? '',
      description: data.author_name ? `by ${data.author_name}` : '',
      image: data.thumbnail_url ?? '',
    };
  } catch {
    return null;
  }
}

async function fetchGenericMeta(rawUrl: string): Promise<Omit<UrlMeta, 'source'>> {
  const empty: Omit<UrlMeta, 'source'> = { title: '', description: '', image: '' };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(rawUrl, {
      signal: ctrl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; YouTubeStudio/1.0; +local) Gecko/20100101 Firefox/130.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return empty;
    const reader = res.body?.getReader();
    if (!reader) return empty;
    const decoder = new TextDecoder('utf-8');
    let html = '';
    let received = 0;
    while (received < MAX_HTML_BYTES) {
      const { value, done } = await reader.read();
      if (done) break;
      received += value.byteLength;
      html += decoder.decode(value, { stream: true });
      // Stop early — head section is usually within first 32KB
      if (html.includes('</head>')) break;
    }
    reader.cancel().catch(() => undefined);
    return parseMetaTags(html, rawUrl);
  } catch {
    return empty;
  }
}

function parseMetaTags(html: string, baseUrl: string): Omit<UrlMeta, 'source'> {
  const head = html.split('</head>')[0] ?? html;
  const og = (prop: string) =>
    matchMeta(head, new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
    matchMeta(head, new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i')) ||
    '';
  const named = (name: string) =>
    matchMeta(head, new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
    matchMeta(head, new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i')) ||
    '';

  const ogTitle = og('og:title');
  const ogDesc = og('og:description');
  const ogImage = og('og:image');
  const titleTag = matchMeta(head, /<title[^>]*>([^<]+)<\/title>/i) || '';
  const metaDesc = named('description');

  const title = decodeEntities(ogTitle || titleTag).trim();
  const description = decodeEntities(ogDesc || metaDesc).trim().slice(0, 280);
  const image = ogImage ? absolutize(ogImage, baseUrl) : '';

  return { title, description, image };
}

function matchMeta(html: string, re: RegExp): string {
  const m = html.match(re);
  return m?.[1] ?? '';
}

function absolutize(maybeRelative: string, baseUrl: string): string {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return maybeRelative;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
