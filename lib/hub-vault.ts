/**
 * Atomic CRUD for Hub clips. Mirrors lib/vault.ts.
 *
 * Storage: `<vault>/1 - Rough Notes/Proyect Notes/YouTube/hub/<slug>.md`
 * Thumbnails: `<slug>.thumb.<ext>` next to the clip file.
 *
 * Round-trip with Obsidian — frontmatter via gray-matter, atomic temp+rename.
 */

import matter from 'gray-matter';
import fs from 'fs/promises';
import path from 'path';
import type {
  HubClip,
  HubClipSummary,
  HubClipFrontmatter,
  HubSource,
  HubClipStatus,
} from './types';
import { isValidSlug } from './schemas';
import { logger } from './logger';
import { getYtPaths } from './yt-config';

const OBSIDIAN_VAULT_NAME = 'vault';

const THUMBNAIL_EXTS = ['jpg', 'jpeg', 'png', 'webp'] as const;
export type HubThumbnailExt = typeof THUMBNAIL_EXTS[number];

function buildObsidianUri(relativePath: string): string {
  return `obsidian://open?vault=${encodeURIComponent(
    OBSIDIAN_VAULT_NAME
  )}&file=${encodeURIComponent(relativePath)}`;
}

function clipPath(hubDir: string, slug: string): string {
  return path.join(hubDir, `${slug}.md`);
}

async function ensureHubDir(hubDir: string): Promise<void> {
  await fs.mkdir(hubDir, { recursive: true });
}

function normalizeFrontmatter(raw: Record<string, unknown>): HubClipFrontmatter {
  const r = raw;
  const rawStatus = r.status as string | undefined;
  const status: HubClipStatus =
    rawStatus === 'read' || rawStatus === 'archived' ? rawStatus : 'new';
  return {
    title: (r.title as string) ?? '',
    url: (r.url as string) ?? '',
    source: (r.source as HubSource) ?? 'other',
    status,
    thumbnail: (r.thumbnail as string) ?? '',
    description: (r.description as string) ?? '',
    category: (r.category as string) ?? '',
    cycle: typeof r.cycle === 'number' ? (r.cycle as number) : null,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    linked_video_slugs: Array.isArray(r.linked_video_slugs)
      ? (r.linked_video_slugs as string[])
      : [],
    created_at:
      typeof r.created_at === 'string'
        ? r.created_at
        : r.created_at instanceof Date
        ? r.created_at.toISOString()
        : new Date().toISOString(),
  };
}

function isHubClipFile(data: Record<string, unknown>): boolean {
  return Array.isArray(data.tags) && (data.tags as string[]).includes('hub-clip');
}

export async function listClips(): Promise<HubClipSummary[]> {
  const { hubDir } = await getYtPaths();
  let files: string[];
  try {
    files = await fs.readdir(hubDir);
  } catch {
    return [];
  }
  const mdFiles = files.filter((f) => f.endsWith('.md'));
  const out: HubClipSummary[] = [];
  for (const file of mdFiles) {
    const filePath = path.join(hubDir, file);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const stat = await fs.stat(filePath);
      const { data } = matter(raw);
      if (!isHubClipFile(data)) continue;
      const slug = path.basename(file, '.md');
      out.push({
        slug,
        frontmatter: normalizeFrontmatter(data),
        obsidianUri: buildObsidianUri(
          `1 - Rough Notes/Proyect Notes/YouTube/hub/${slug}`
        ),
        mtime: stat.mtimeMs,
      });
    } catch (e) {
      logger.warn('hubVault.listClips', 'file read failed', {
        file,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return out;
}

export async function getClip(slug: string): Promise<HubClip | null> {
  if (!isValidSlug(slug)) return null;
  const { hubDir } = await getYtPaths();
  const p = clipPath(hubDir, slug);
  try {
    const raw = await fs.readFile(p, 'utf-8');
    const stat = await fs.stat(p);
    const { data, content } = matter(raw);
    if (!isHubClipFile(data)) return null;
    return {
      slug,
      frontmatter: normalizeFrontmatter(data),
      body: content,
      obsidianUri: buildObsidianUri(
        `1 - Rough Notes/Proyect Notes/YouTube/hub/${slug}`
      ),
      mtime: stat.mtimeMs,
    };
  } catch {
    return null;
  }
}

export interface CreateClipInput {
  slug: string;
  title: string;
  url: string;
  source: HubSource;
  description?: string;
  thumbnail?: string;
  category?: string;
  cycle?: number | null;
  tags?: string[];
}

export async function createClip(input: CreateClipInput): Promise<HubClip> {
  if (!isValidSlug(input.slug)) throw new Error(`Invalid slug: ${input.slug}`);
  const { hubDir } = await getYtPaths();
  await ensureHubDir(hubDir);
  const p = clipPath(hubDir, input.slug);
  try {
    await fs.access(p);
    throw new Error(`Clip ${input.slug} already exists`);
  } catch (e) {
    if (e instanceof Error && e.message.includes('already exists')) throw e;
  }
  const frontmatter: Record<string, unknown> = {
    title: input.title,
    url: input.url,
    source: input.source,
    status: 'new',
    thumbnail: input.thumbnail ?? '',
    description: input.description ?? '',
    category: input.category ?? '',
    cycle: input.cycle ?? null,
    tags: ['hub-clip', ...(input.tags ?? [])],
    linked_video_slugs: [],
    created_at: new Date().toISOString(),
  };
  const output = matter.stringify('', frontmatter);
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, output, 'utf-8');
  await fs.rename(tmp, p);
  const stat = await fs.stat(p);
  logger.info('hubVault.createClip', 'created', { slug: input.slug });
  return {
    slug: input.slug,
    frontmatter: normalizeFrontmatter(frontmatter),
    body: '',
    obsidianUri: buildObsidianUri(
      `1 - Rough Notes/Proyect Notes/YouTube/hub/${input.slug}`
    ),
    mtime: stat.mtimeMs,
  };
}

export interface ClipUpdate {
  frontmatter?: Partial<HubClipFrontmatter>;
  body?: string;
}

export async function updateClip(slug: string, updates: ClipUpdate): Promise<HubClip> {
  if (!isValidSlug(slug)) throw new Error(`Invalid slug: ${slug}`);
  const { hubDir } = await getYtPaths();
  const p = clipPath(hubDir, slug);
  const raw = await fs.readFile(p, 'utf-8');
  const { data, content } = matter(raw);
  const merged = { ...data, ...(updates.frontmatter ?? {}) };
  // Preserve hub-clip tag
  const tags = Array.isArray(merged.tags) ? (merged.tags as string[]) : [];
  if (!tags.includes('hub-clip')) merged.tags = ['hub-clip', ...tags];
  const nextBody = updates.body !== undefined ? updates.body : content;
  const output = matter.stringify(nextBody, merged);
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, output, 'utf-8');
  await fs.rename(tmp, p);
  const stat = await fs.stat(p);
  return {
    slug,
    frontmatter: normalizeFrontmatter(merged),
    body: nextBody,
    obsidianUri: buildObsidianUri(
      `1 - Rough Notes/Proyect Notes/YouTube/hub/${slug}`
    ),
    mtime: stat.mtimeMs,
  };
}

export async function deleteClip(slug: string): Promise<{ slug: string; trashedAt: number }> {
  if (!isValidSlug(slug)) throw new Error(`Invalid slug: ${slug}`);
  const { hubDir, hubTrashDir } = await getYtPaths();
  const p = clipPath(hubDir, slug);
  try {
    await fs.access(p);
  } catch {
    throw new Error(`Clip ${slug} not found`);
  }
  await fs.mkdir(hubTrashDir, { recursive: true });
  const trashedAt = Date.now();
  const target = path.join(hubTrashDir, `${slug}-${trashedAt}.md`);
  await fs.rename(p, target);
  // Move thumbnail alongside (same -<trashedAt>.thumb.<ext> suffix)
  for (const ext of THUMBNAIL_EXTS) {
    const thumbSrc = path.join(hubDir, `${slug}.thumb.${ext}`);
    const thumbDst = path.join(hubTrashDir, `${slug}-${trashedAt}.thumb.${ext}`);
    try { await fs.rename(thumbSrc, thumbDst); } catch { /* may not exist */ }
  }
  logger.info('hubVault.deleteClip', 'trashed', { slug });
  return { slug, trashedAt };
}

// ───── Thumbnails (mirror video pattern) ────────────────────────

export async function findClipThumbnail(slug: string): Promise<{ path: string; ext: HubThumbnailExt } | null> {
  if (!isValidSlug(slug)) return null;
  const { hubDir } = await getYtPaths();
  for (const ext of THUMBNAIL_EXTS) {
    const tp = path.join(hubDir, `${slug}.thumb.${ext}`);
    try {
      await fs.access(tp);
      return { path: tp, ext };
    } catch {}
  }
  return null;
}

export async function writeClipThumbnail(
  slug: string,
  ext: HubThumbnailExt,
  data: Buffer
): Promise<void> {
  if (!isValidSlug(slug)) throw new Error(`Invalid slug: ${slug}`);
  if (!THUMBNAIL_EXTS.includes(ext)) throw new Error(`Invalid extension: ${ext}`);
  const { hubDir } = await getYtPaths();
  await ensureHubDir(hubDir);
  const existing = await findClipThumbnail(slug);
  if (existing && existing.ext !== ext) {
    try { await fs.unlink(existing.path); } catch {}
  }
  const target = path.join(hubDir, `${slug}.thumb.${ext}`);
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, target);
}

const ALLOWED_IMAGE_HOSTS_LIMIT = 8 * 1024 * 1024;

/**
 * Download an image URL to disk. Tolerant — returns null on failure.
 * Caps at 8MB to avoid pulling enormous assets.
 */
export async function downloadImageForClip(slug: string, imageUrl: string): Promise<HubThumbnailExt | null> {
  if (!isValidSlug(slug)) return null;
  if (!imageUrl) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(imageUrl, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') ?? '').toLowerCase();
    let ext: HubThumbnailExt | null = null;
    if (ct.includes('jpeg') || ct.includes('jpg')) ext = 'jpg';
    else if (ct.includes('png')) ext = 'png';
    else if (ct.includes('webp')) ext = 'webp';
    else {
      // Fall back to URL extension
      const m = imageUrl.match(/\.(jpe?g|png|webp)(?:\?.*)?$/i);
      if (m) ext = (m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()) as HubThumbnailExt;
    }
    if (!ext) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > ALLOWED_IMAGE_HOSTS_LIMIT) return null;
    await writeClipThumbnail(slug, ext, buf);
    return ext;
  } catch {
    return null;
  }
}

export async function listExistingSlugs(): Promise<Set<string>> {
  try {
    const { hubDir } = await getYtPaths();
    const files = await fs.readdir(hubDir);
    const out = new Set<string>();
    for (const f of files) {
      if (f.endsWith('.md')) out.add(path.basename(f, '.md'));
    }
    return out;
  } catch {
    return new Set();
  }
}

// ───── Trash ────────────────────────────────────────────────────

export interface TrashedClip {
  slug: string;
  trashedAt: number;
  title: string;
  fileName: string;
}

export async function listTrashedClips(): Promise<TrashedClip[]> {
  try {
    const { hubTrashDir } = await getYtPaths();
    const files = await fs.readdir(hubTrashDir);
    const out: TrashedClip[] = [];
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const m = file.match(/^(.+)-(\d+)\.md$/);
      if (!m) continue;
      const [, slug, tsStr] = m;
      try {
        const raw = await fs.readFile(path.join(hubTrashDir, file), 'utf-8');
        const { data } = matter(raw);
        out.push({
          slug,
          trashedAt: Number(tsStr),
          title: (data.title as string) ?? slug,
          fileName: file,
        });
      } catch {
        continue;
      }
    }
    return out.sort((a, b) => b.trashedAt - a.trashedAt);
  } catch {
    return [];
  }
}

export async function restoreClip(slug: string, trashedAt: number): Promise<HubClip> {
  if (!isValidSlug(slug)) throw new Error(`Invalid slug: ${slug}`);
  const { hubDir, hubTrashDir } = await getYtPaths();
  const trashedPath = path.join(hubTrashDir, `${slug}-${trashedAt}.md`);
  const target = clipPath(hubDir, slug);
  try {
    await fs.access(target);
    throw new Error(`Clip ${slug} already exists — cannot restore`);
  } catch (e) {
    if (e instanceof Error && e.message.includes('already exists')) throw e;
  }
  await ensureHubDir(hubDir);
  await fs.rename(trashedPath, target);
  // Restore thumbnail back to canonical location if it was trashed
  for (const ext of THUMBNAIL_EXTS) {
    const thumbSrc = path.join(hubTrashDir, `${slug}-${trashedAt}.thumb.${ext}`);
    const thumbDst = path.join(hubDir, `${slug}.thumb.${ext}`);
    try { await fs.rename(thumbSrc, thumbDst); } catch {}
  }
  logger.info('hubVault.restoreClip', 'restored', { slug });
  const clip = await getClip(slug);
  if (!clip) throw new Error('Restore failed to materialize');
  return clip;
}

export async function purgeTrashedClip(fileName: string): Promise<void> {
  if (!/^[a-z0-9-]+-\d+\.md$/.test(fileName)) throw new Error('Invalid fileName');
  const m = fileName.match(/^(.+)-(\d+)\.md$/);
  if (!m) throw new Error('Invalid fileName');
  const [, slug, tsStr] = m;
  const { hubTrashDir } = await getYtPaths();
  const p = path.join(hubTrashDir, fileName);
  await fs.unlink(p);
  // Permanently delete trashed thumbnail companion (kept alongside since deleteClip).
  for (const ext of THUMBNAIL_EXTS) {
    const thumb = path.join(hubTrashDir, `${slug}-${tsStr}.thumb.${ext}`);
    try { await fs.unlink(thumb); } catch {}
  }
  logger.info('hubVault.purgeTrashedClip', 'purged', { fileName });
}
