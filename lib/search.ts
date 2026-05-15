/**
 * Server-side full-text search across video bodies, hub clip notes,
 * and reference docs. Reads files at query time — no pre-built index.
 *
 * Corpus is small (~30 files × ~5KB avg) → sub-50ms on local SSD.
 */

import matter from 'gray-matter';
import fs from 'fs/promises';
import type { Dirent } from 'fs';
import path from 'path';
import { getYtPaths } from './yt-config';

const SNIPPET_RADIUS = 50;
const MAX_PER_GROUP = 5;
const HUB_EXCLUDE = new Set(['app-state-snapshot.md']);

export interface SearchHit {
  slug: string;
  title: string;
  snippet: string;
  matchField: 'title' | 'body';
}

export interface VideoSearchHit extends SearchHit {
  status: string;
}

export interface ClipSearchHit extends SearchHit {
  source: string;
}

export interface SearchResult {
  videos: VideoSearchHit[];
  clips: ClipSearchHit[];
  docs: SearchHit[];
  query: string;
}

function extractSnippet(text: string, query: string): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return '';
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(text.length, idx + query.length + SNIPPET_RADIUS);
  let snippet = text.slice(start, end).replace(/\r?\n/g, ' ');
  if (start > 0) snippet = '…' + snippet;
  if (end < text.length) snippet = snippet + '…';
  return snippet;
}

function matchesQuery(text: string, q: string): boolean {
  return text.toLowerCase().includes(q);
}

async function searchVideos(q: string): Promise<VideoSearchHit[]> {
  const { videosDir } = await getYtPaths();
  let files: string[];
  try {
    files = await fs.readdir(videosDir);
  } catch {
    return [];
  }
  const hits: VideoSearchHit[] = [];
  for (const file of files) {
    if (!file.endsWith('.md') || file.endsWith('.meta.md')) continue;
    try {
      const raw = await fs.readFile(path.join(videosDir, file), 'utf-8');
      const { data, content } = matter(raw);
      if (!Array.isArray(data.tags) || !(data.tags as string[]).includes('video')) continue;
      const title = (data.title as string) ?? '';
      const slug = path.basename(file, '.md');
      const status = (data.status as string) ?? 'idea';

      if (matchesQuery(title, q)) {
        hits.push({
          slug,
          title,
          status,
          snippet: extractSnippet(title, q),
          matchField: 'title',
        });
      } else if (matchesQuery(content, q)) {
        hits.push({
          slug,
          title,
          status,
          snippet: extractSnippet(content, q),
          matchField: 'body',
        });
      }
    } catch {
      continue;
    }
    if (hits.length >= MAX_PER_GROUP) break;
  }
  return hits;
}

async function searchClips(q: string): Promise<ClipSearchHit[]> {
  const { hubDir } = await getYtPaths();
  let files: string[];
  try {
    files = await fs.readdir(hubDir);
  } catch {
    return [];
  }
  const hits: ClipSearchHit[] = [];
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    try {
      const raw = await fs.readFile(path.join(hubDir, file), 'utf-8');
      const { data, content } = matter(raw);
      if (!Array.isArray(data.tags) || !(data.tags as string[]).includes('hub-clip')) continue;
      const title = (data.title as string) ?? '';
      const desc = (data.description as string) ?? '';
      const slug = path.basename(file, '.md');
      const source = (data.source as string) ?? 'other';
      const searchable = `${title}\n${desc}\n${content}`;

      if (matchesQuery(title, q)) {
        hits.push({ slug, title, source, snippet: extractSnippet(title, q), matchField: 'title' });
      } else if (matchesQuery(searchable, q)) {
        hits.push({ slug, title, source, snippet: extractSnippet(searchable, q), matchField: 'body' });
      }
    } catch {
      continue;
    }
    if (hits.length >= MAX_PER_GROUP) break;
  }
  return hits;
}

async function searchDocs(q: string): Promise<SearchHit[]> {
  const { ytRoot } = await getYtPaths();
  let entries: Dirent[];
  try {
    entries = (await fs.readdir(ytRoot, { withFileTypes: true })) as Dirent[];
  } catch {
    return [];
  }
  const hits: SearchHit[] = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.md') || HUB_EXCLUDE.has(e.name)) continue;
    try {
      const raw = await fs.readFile(path.join(ytRoot, e.name), 'utf-8');
      const { data, content } = matter(raw);
      const slug = path.basename(e.name, '.md');
      const title = (data.title as string) || slug.split('-').map((w: string) => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');

      if (matchesQuery(title, q)) {
        hits.push({ slug, title, snippet: extractSnippet(title, q), matchField: 'title' });
      } else if (matchesQuery(content, q)) {
        hits.push({ slug, title, snippet: extractSnippet(content, q), matchField: 'body' });
      }
    } catch {
      continue;
    }
    if (hits.length >= MAX_PER_GROUP) break;
  }
  return hits;
}

export async function searchCorpus(query: string): Promise<SearchResult> {
  const q = query.trim();
  if (q.length < 2) return { videos: [], clips: [], docs: [], query: q };
  const [videos, clips, docs] = await Promise.all([
    searchVideos(q),
    searchClips(q),
    searchDocs(q),
  ]);
  return { videos, clips, docs, query: q };
}
