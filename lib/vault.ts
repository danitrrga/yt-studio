import matter from 'gray-matter';
import fs from 'fs/promises';
import path from 'path';
import type {
  Video,
  VideoSummary,
  VideoFrontmatter,
  HubPage,
  VideoMeta,
  VideoMetaSection,
  VideoMetaSectionId,
} from './types';
import { isValidSlug } from './schemas';
import { logger } from './logger';
import { recordEvents } from './telemetry-store';
import { getYtPaths } from './yt-config';

// All paths (videosDir, trashDir, ytRoot, templatesDir, diagnosticsDir) are
// resolved per-call via `await getYtPaths()` so the user can change the
// content path at runtime without restarting the server.

const META_SECTION_ORDER: { id: VideoMetaSectionId; heading: string }[] = [
  { id: 'idea', heading: 'Idea' },
  { id: 'production', heading: 'Production' },
  { id: 'publish', heading: 'Publish' },
  { id: 'title_ideas', heading: 'Title Ideas' },
  { id: 'thumbnail_ideas', heading: 'Thumbnail Ideas' },
  { id: 'post_mortem', heading: 'Post-Mortem' },
];

function metaPath(videosDir: string, slug: string): string {
  return path.join(videosDir, `${slug}.meta.md`);
}

const THUMBNAIL_EXTS = ['jpg', 'jpeg', 'png', 'webp'] as const;
export type ThumbnailExt = typeof THUMBNAIL_EXTS[number];

export async function findThumbnailPath(slug: string): Promise<{ path: string; ext: ThumbnailExt } | null> {
  if (!isValidSlug(slug)) return null;
  const { videosDir } = await getYtPaths();
  for (const ext of THUMBNAIL_EXTS) {
    const p = path.join(videosDir, `${slug}.thumb.${ext}`);
    try {
      await fs.access(p);
      return { path: p, ext };
    } catch {}
  }
  return null;
}

export async function writeThumbnail(slug: string, ext: ThumbnailExt, data: Buffer): Promise<void> {
  if (!isValidSlug(slug)) throw new Error(`Invalid slug: ${slug}`);
  if (!THUMBNAIL_EXTS.includes(ext)) throw new Error(`Invalid extension: ${ext}`);
  const { videosDir } = await getYtPaths();
  // Remove any existing thumbnail with a different extension
  const existing = await findThumbnailPath(slug);
  if (existing && existing.ext !== ext) {
    try { await fs.unlink(existing.path); } catch {}
  }
  const target = path.join(videosDir, `${slug}.thumb.${ext}`);
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, target);
  logger.info('vault.writeThumbnail', 'wrote', { slug, ext, bytes: data.length });
  await recordEvents([
    {
      scope: 'thumbnail',
      event: 'uploaded',
      level: 'info',
      slug,
      payload: { ext, bytes: data.length },
    },
  ]);
}

export async function deleteThumbnail(slug: string): Promise<boolean> {
  if (!isValidSlug(slug)) return false;
  const existing = await findThumbnailPath(slug);
  if (!existing) return false;
  await fs.unlink(existing.path);
  logger.info('vault.deleteThumbnail', 'removed', { slug });
  return true;
}

function parseMetaSections(markdown: string): VideoMetaSection[] {
  const lines = markdown.split(/\r?\n/);
  const out: VideoMetaSection[] = [];
  let current: { heading: string; buf: string[] } | null = null;
  const push = (s: { heading: string; buf: string[] } | null) => {
    if (!s) return;
    const finalized = finalizeSection(s);
    if (finalized) out.push(finalized);
  };
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      push(current);
      current = { heading: h2[1].trim(), buf: [] };
      continue;
    }
    if (current) current.buf.push(line);
  }
  push(current);
  return out;
}

function finalizeSection(s: { heading: string; buf: string[] }): VideoMetaSection | null {
  const id = headingToId(s.heading);
  if (!id) return null;
  return { id, heading: s.heading, body: s.buf.join('\n').trim() };
}

function headingToId(heading: string): VideoMetaSectionId | null {
  const norm = heading.toLowerCase().trim();
  if (norm.startsWith('idea')) return 'idea';
  if (norm.startsWith('production')) return 'production';
  if (norm.startsWith('publish')) return 'publish';
  if (norm.startsWith('title')) return 'title_ideas';
  if (norm.startsWith('thumbnail')) return 'thumbnail_ideas';
  if (norm.startsWith('post-mortem') || norm.startsWith('post mortem')) return 'post_mortem';
  return null;
}

function metaLinkHeader(slug: string): string {
  return `> Meta for [[${slug}]] · part of [[youtube-production]]`;
}

function serializeMetaSections(slug: string, sections: VideoMetaSection[]): string {
  const body = sections
    .map((s) => `## ${s.heading}\n\n${s.body}\n`)
    .join('\n')
    .replace(/\n+$/, '\n');
  return `${metaLinkHeader(slug)}\n\n${body}`;
}
const OBSIDIAN_VAULT_NAME = 'vault';

async function loadTemplateBody(): Promise<string> {
  const { templatesDir } = await getYtPaths();
  try {
    const raw = await fs.readFile(path.join(templatesDir, 'video-template.md'), 'utf-8');
    const parsed = matter(raw);
    return parsed.content;
  } catch {
    return '';
  }
}

async function loadMetaTemplate(): Promise<string> {
  const { templatesDir } = await getYtPaths();
  try {
    return await fs.readFile(path.join(templatesDir, 'video-meta-template.md'), 'utf-8');
  } catch {
    return META_SECTION_ORDER.map((s) => `## ${s.heading}\n\n`).join('\n');
  }
}

export async function readVideoMeta(slug: string): Promise<VideoMeta | null> {
  if (!isValidSlug(slug)) throw new Error(`Invalid slug: ${slug}`);
  const { videosDir } = await getYtPaths();
  const p = metaPath(videosDir, slug);
  try {
    const raw = await fs.readFile(p, 'utf-8');
    const stat = await fs.stat(p);
    return {
      slug,
      sections: parseMetaSections(raw),
      mtime: stat.mtimeMs,
    };
  } catch {
    return null;
  }
}

export async function updateVideoMeta(
  slug: string,
  sections: VideoMetaSection[]
): Promise<VideoMeta> {
  if (!isValidSlug(slug)) throw new Error(`Invalid slug: ${slug}`);
  const { videosDir } = await getYtPaths();
  const p = metaPath(videosDir, slug);
  const body = serializeMetaSections(slug, sections);
  const tempPath = `${p}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, body, 'utf-8');
  await fs.rename(tempPath, p);
  const stat = await fs.stat(p);
  logger.info('vault.updateVideoMeta', 'wrote', { slug });
  return { slug, sections, mtime: stat.mtimeMs };
}

async function createVideoMetaSidecar(slug: string): Promise<void> {
  const { videosDir } = await getYtPaths();
  const p = metaPath(videosDir, slug);
  try {
    await fs.access(p);
    return;
  } catch {
    // not exists — create
  }
  const template = await loadMetaTemplate();
  const body = `${metaLinkHeader(slug)}\n\n${template}`;
  const tempPath = `${p}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, body, 'utf-8');
  await fs.rename(tempPath, p);
  logger.info('vault.createVideoMetaSidecar', 'created', { slug });
}

function fillTemplate(body: string, ctx: { title: string; slug: string; date: string }): string {
  return body
    .replaceAll('{{title}}', ctx.title)
    .replaceAll('{{slug}}', ctx.slug)
    .replaceAll('{{date}}', ctx.date)
    .replaceAll('{{created}}', ctx.date);
}

// Filenames at YT_ROOT that are NOT reference docs.
const HUB_EXCLUDE = new Set(['app-state-snapshot.md']);

async function listHubDocFiles(): Promise<string[]> {
  try {
    const { ytRoot } = await getYtPaths();
    const entries = await fs.readdir(ytRoot, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.md') && !HUB_EXCLUDE.has(e.name))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function titleCaseFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// Canonical templates surfaced in the Hub reference-docs section.
// Editing these from the app rewrites the file in <root>/templates/, so
// every future `createVideo` call picks up the new structure.

interface TemplateDoc {
  slug: string;     // virtual slug used in URLs (no collision with ytRoot files)
  fileName: string; // actual filename inside <root>/templates/
  title: string;    // display title in the reference-docs grid
}

const TEMPLATE_DOCS: TemplateDoc[] = [
  { slug: 'tpl-video', fileName: 'video-template.md', title: 'Video script template' },
  { slug: 'tpl-video-meta', fileName: 'video-meta-template.md', title: 'Video meta template' },
];

function isTemplateSlug(slug: string): TemplateDoc | undefined {
  return TEMPLATE_DOCS.find((t) => t.slug === slug);
}

function templateObsidianUri(t: TemplateDoc): string {
  return buildObsidianUri(`5 - Templates/${path.basename(t.fileName, '.md')}`);
}

function toSlug(filename: string): string {
  return path.basename(filename, '.md');
}

function buildObsidianUri(relativePath: string): string {
  return `obsidian://open?vault=${encodeURIComponent(
    OBSIDIAN_VAULT_NAME
  )}&file=${encodeURIComponent(relativePath)}`;
}

function toDateStr(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().split('T')[0];
  if (typeof v === 'string') {
    const trim = v.trim();
    if (!trim) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(trim)) return trim.slice(0, 10);
    return trim;
  }
  return null;
}

function normalizeFrontmatter(raw: Record<string, unknown>): VideoFrontmatter {
  const r = raw as Record<string, unknown>;
  return {
    title: (r.title as string) ?? '',
    status: (r.status as VideoFrontmatter['status']) ?? 'idea',
    content_type: (r.content_type as VideoFrontmatter['content_type']) ?? 'long',
    category: (r.category as string) ?? '',
    audience: (r.audience as VideoFrontmatter['audience']) ?? 'TOFU',
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    linked_notes: Array.isArray(r.linked_notes) ? (r.linked_notes as string[]) : [],
    target_date: toDateStr(r.target_date),
    record_date: toDateStr(r.record_date),
    published_date: toDateStr(r.published_date),
    cycle: (r.cycle as number) ?? null,
    created: toDateStr(r.created) ?? new Date().toISOString().split('T')[0],
  };
}

function isVideoFile(data: Record<string, unknown>): boolean {
  return Array.isArray(data.tags) && (data.tags as string[]).includes('video');
}

/**
 * Body normalization for the script editor.
 *
 * The legacy template baked structural noise into every video body:
 *   1. `#### Tags: [[a]] [[b]] ...` — duplicates frontmatter.tags
 *   2. `## Script` — pure wrapper heading
 *   3. `## Links` ... `- [[wiki]]` ... — references that belong in metadata
 *
 * All three are stripped at read-time so the editor surfaces only script
 * content. Links are parsed out and surfaced in the page header. On the
 * user's next save, the cleaned body atomically replaces the file content,
 * completing migration passively (no bulk script needed).
 */
const LEGACY_TAGS_LINE_RE = /^\s*#{1,6}\s+Tags:.*\r?\n(?:\r?\n)?/;
const SCRIPT_HEADING_RE = /^\s*#{1,6}\s+Script\s*\r?\n(?:\r?\n)?/m;
// "## Links" + everything from there to either the next H2 or end of body
const LINKS_SECTION_RE = /\r?\n*#{1,6}\s+Links\s*\r?\n[\s\S]*?(?=\r?\n#{1,2}\s|\s*$)/;
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

function extractLinksFromSection(body: string): string[] {
  const m = body.match(LINKS_SECTION_RE);
  if (!m) return [];
  const out: string[] = [];
  for (const w of m[0].matchAll(WIKILINK_RE)) {
    const slug = w[1].trim();
    if (slug) out.push(slug);
  }
  return out;
}

/**
 * Promote heading levels by one when the body has no H1 or H2 headings.
 * Idempotent — once an H2 exists, leaves the doc alone.
 *
 * Rationale: stripping `## Script` leaves `### Hook` as top-level. Promoting
 * to H2 keeps the live-preview hierarchy correct.
 */
function promoteHeadings(body: string): string {
  if (/^#{1,2}\s/m.test(body)) return body;
  return body.replace(/^(#+)(\s)/gm, (_, hashes: string, ws: string) =>
    hashes.length > 1 ? '#'.repeat(hashes.length - 1) + ws : `#${ws}`
  );
}

function normalizeBody(body: string): { body: string; links: string[] } {
  const links = extractLinksFromSection(body);
  let next = body.replace(LEGACY_TAGS_LINE_RE, '');
  next = next.replace(LINKS_SECTION_RE, '');
  next = next.replace(SCRIPT_HEADING_RE, '');
  // Trim leading blanks the strips may have left
  next = next.replace(/^\s*\n/, '');
  next = promoteHeadings(next);
  return { body: next, links };
}

// Once-per-process guard so multiple SWR revalidates don't all try to
// migrate the same legacy file. Keyed by slug.
const migratedLinksThisBoot = new Set<string>();

export async function getVideos(): Promise<VideoSummary[]> {
  const { videosDir } = await getYtPaths();
  let files: string[];
  try {
    files = await fs.readdir(videosDir);
  } catch (e) {
    logger.error('vault.getVideos', 'videos dir read failed', {
      path: videosDir,
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
  const mdFiles = files.filter((f) => f.endsWith('.md') && !f.endsWith('.meta.md'));

  const videos: VideoSummary[] = [];
  for (const file of mdFiles) {
    const filePath = path.join(videosDir, file);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const stat = await fs.stat(filePath);
      const { data } = matter(raw);
      if (!isVideoFile(data)) continue;

      const slug = toSlug(file);
      const fm = normalizeFrontmatter(data);
      videos.push({
        slug,
        frontmatter: fm,
        links: fm.linked_notes,
        obsidianUri: buildObsidianUri(
          `1 - Rough Notes/Proyect Notes/YouTube/videos/${slug}`
        ),
        mtime: stat.mtimeMs,
      });
    } catch (e) {
      logger.warn('vault.getVideos', 'file read failed', {
        file,
        error: e instanceof Error ? e.message : String(e),
      });
      continue;
    }
  }
  return videos;
}

// Boot-time path verification. Called from a server module on cold start.
export async function verifyVaultPath(): Promise<boolean> {
  const { videosDir } = await getYtPaths();
  try {
    const stat = await fs.stat(videosDir);
    if (!stat.isDirectory()) {
      logger.error('vault.verify', 'videosDir is not a directory', { path: videosDir });
      return false;
    }
    logger.info('vault.verify', 'vault path OK', { path: videosDir });
    return true;
  } catch (e) {
    logger.error('vault.verify', 'videosDir missing or inaccessible', {
      path: videosDir,
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

export async function getVideo(slug: string): Promise<Video | null> {
  if (!isValidSlug(slug)) {
    logger.warn('vault.getVideo', 'rejected invalid slug', { slug });
    return null;
  }
  const { videosDir } = await getYtPaths();
  const filePath = path.join(videosDir, `${slug}.md`);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const stat = await fs.stat(filePath);
    const { data, content } = matter(raw);
    if (!isVideoFile(data)) return null;
    const fm = normalizeFrontmatter(data);
    const { body: cleanBody, links: bodyLinks } = normalizeBody(content);

    // Frontmatter is the source of truth. If it's empty AND the body had a
    // legacy `## Links` section, migrate inline (one-shot per boot per slug).
    const fmLinks = fm.linked_notes;
    const links = fmLinks.length > 0 ? fmLinks : bodyLinks;

    if (
      fmLinks.length === 0 &&
      bodyLinks.length > 0 &&
      !migratedLinksThisBoot.has(slug)
    ) {
      migratedLinksThisBoot.add(slug);
      // Fire-and-forget; the next read will see the populated frontmatter.
      // updateVideo persists frontmatter atomically and writes the cleaned
      // body too (Links section already absent here).
      updateVideo(slug, {
        frontmatter: { linked_notes: bodyLinks },
        body: cleanBody,
      }).catch((e) => {
        migratedLinksThisBoot.delete(slug);
        logger.warn('vault.getVideo', 'links migration write failed', {
          slug,
          error: e instanceof Error ? e.message : String(e),
        });
      });
    }

    return {
      slug,
      frontmatter: { ...fm, linked_notes: links },
      body: cleanBody,
      links,
      obsidianUri: buildObsidianUri(
        `1 - Rough Notes/Proyect Notes/YouTube/videos/${slug}`
      ),
      mtime: stat.mtimeMs,
    };
  } catch {
    return null;
  }
}

const DATE_FIELDS = ['target_date', 'record_date', 'published_date', 'created'];

function sanitizeForYaml(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const k of DATE_FIELDS) {
    const v = out[k];
    if (v instanceof Date) out[k] = v.toISOString().split('T')[0];
    else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) out[k] = v.slice(0, 10);
  }
  return out;
}

export interface VideoUpdate {
  frontmatter?: Partial<VideoFrontmatter>;
  body?: string;
}

export async function updateVideo(slug: string, updates: VideoUpdate): Promise<Video> {
  if (!isValidSlug(slug)) {
    throw new Error(`Invalid slug: ${slug}`);
  }
  const { videosDir } = await getYtPaths();
  const filePath = path.join(videosDir, `${slug}.md`);
  const raw = await fs.readFile(filePath, 'utf-8');
  const { data, content } = matter(raw);

  const mergedData = sanitizeForYaml({ ...data, ...(updates.frontmatter ?? {}) });
  const nextBody = updates.body !== undefined ? updates.body : content;

  const output = matter.stringify(nextBody, mergedData);

  // Atomic write: write to tempfile + rename. Survives crashes mid-write.
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tempPath, output, 'utf-8');
    await fs.rename(tempPath, filePath);
  } catch (e) {
    // Cleanup temp if rename failed
    try { await fs.unlink(tempPath); } catch {}
    throw e;
  }

  const stat = await fs.stat(filePath);
  const { body: cleanBody } = normalizeBody(nextBody);
  const fm = normalizeFrontmatter(mergedData);
  return {
    slug,
    frontmatter: fm,
    body: cleanBody,
    links: fm.linked_notes,
    obsidianUri: buildObsidianUri(
      `1 - Rough Notes/Proyect Notes/YouTube/videos/${slug}`
    ),
    mtime: stat.mtimeMs,
  };
}

export interface CreateVideoInput {
  slug: string;
  title: string;
  status?: VideoFrontmatter['status'];
  target_date?: string | null;
  audience?: VideoFrontmatter['audience'];
}

export async function createVideo(input: CreateVideoInput): Promise<Video> {
  if (!isValidSlug(input.slug)) throw new Error(`Invalid slug: ${input.slug}`);
  const { videosDir } = await getYtPaths();
  const filePath = path.join(videosDir, `${input.slug}.md`);
  let exists = false;
  try {
    await fs.access(filePath);
    exists = true;
  } catch {
    // ENOENT — good, file doesn't exist
  }
  if (exists) throw new Error(`Video ${input.slug} already exists`);

  const today = new Date().toISOString().split('T')[0];
  const frontmatter: Record<string, unknown> = {
    title: input.title,
    status: input.status ?? 'idea',
    content_type: 'long',
    category: '',
    audience: input.audience ?? 'TOFU',
    tags: ['youtube', 'video'],
    target_date: input.target_date ?? null,
    record_date: null,
    published_date: null,
    cycle: null,
    created: today,
  };

  const rawBody = await loadTemplateBody();
  const body = rawBody
    ? fillTemplate(rawBody, { title: input.title, slug: input.slug, date: today })
    : '';

  const output = matter.stringify(body, frontmatter);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, output, 'utf-8');
  await fs.rename(tempPath, filePath);
  logger.info('vault.createVideo', 'created', { slug: input.slug, fromTemplate: !!rawBody });
  await recordEvents([
    {
      scope: 'video',
      event: 'created',
      level: 'info',
      slug: input.slug,
      payload: { fromTemplate: !!rawBody },
    },
  ]);

  await createVideoMetaSidecar(input.slug);

  const stat = await fs.stat(filePath);
  return {
    slug: input.slug,
    frontmatter: normalizeFrontmatter(frontmatter),
    body,
    links: [],
    obsidianUri: buildObsidianUri(
      `1 - Rough Notes/Proyect Notes/YouTube/videos/${input.slug}`
    ),
    mtime: stat.mtimeMs,
  };
}

export interface TrashedVideo {
  slug: string;
  trashedPath: string;
  trashedAt: number;
}

// Move a video's companion files (meta sidecar + thumbnails) into the trash dir
// alongside its main .md, suffixed with -<trashedAt>. Silently skips files that
// don't exist — companions are optional.
async function moveCompanionsToTrash(slug: string, trashedAt: number): Promise<void> {
  const { videosDir, trashDir } = await getYtPaths();
  const metaSrc = metaPath(videosDir, slug);
  const metaDst = path.join(trashDir, `${slug}-${trashedAt}.meta.md`);
  try { await fs.rename(metaSrc, metaDst); } catch { /* may not exist */ }
  for (const ext of THUMBNAIL_EXTS) {
    const thumbSrc = path.join(videosDir, `${slug}.thumb.${ext}`);
    const thumbDst = path.join(trashDir, `${slug}-${trashedAt}.thumb.${ext}`);
    try { await fs.rename(thumbSrc, thumbDst); } catch { /* may not exist */ }
  }
}

// Restore companions back to canonical names in videosDir. Silently skips
// any companion that wasn't trashed (e.g., a video deleted before sidecars
// were a thing).
async function restoreCompanionsFromTrash(slug: string, trashedAt: number): Promise<void> {
  const { videosDir, trashDir } = await getYtPaths();
  const metaSrc = path.join(trashDir, `${slug}-${trashedAt}.meta.md`);
  const metaDst = metaPath(videosDir, slug);
  try { await fs.rename(metaSrc, metaDst); } catch {}
  for (const ext of THUMBNAIL_EXTS) {
    const thumbSrc = path.join(trashDir, `${slug}-${trashedAt}.thumb.${ext}`);
    const thumbDst = path.join(videosDir, `${slug}.thumb.${ext}`);
    try { await fs.rename(thumbSrc, thumbDst); } catch {}
  }
}

// Permanently delete companions in trashDir.
async function purgeCompanions(slug: string, trashedAtStr: string): Promise<void> {
  const { trashDir } = await getYtPaths();
  const meta = path.join(trashDir, `${slug}-${trashedAtStr}.meta.md`);
  try { await fs.unlink(meta); } catch {}
  for (const ext of THUMBNAIL_EXTS) {
    const thumb = path.join(trashDir, `${slug}-${trashedAtStr}.thumb.${ext}`);
    try { await fs.unlink(thumb); } catch {}
  }
}

export async function deleteVideo(slug: string): Promise<TrashedVideo> {
  if (!isValidSlug(slug)) throw new Error(`Invalid slug: ${slug}`);
  const { videosDir, trashDir } = await getYtPaths();
  const filePath = path.join(videosDir, `${slug}.md`);
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Video ${slug} not found`);
  }
  await fs.mkdir(trashDir, { recursive: true });
  const trashedAt = Date.now();
  const trashedPath = path.join(trashDir, `${slug}-${trashedAt}.md`);
  await fs.rename(filePath, trashedPath);
  await moveCompanionsToTrash(slug, trashedAt);
  logger.info('vault.deleteVideo', 'moved to trash', { slug, trashedPath });
  await recordEvents([
    { scope: 'video', event: 'deleted', level: 'info', slug },
  ]);
  return { slug, trashedPath, trashedAt };
}

export async function restoreVideo(slug: string, trashedAt: number): Promise<Video> {
  if (!isValidSlug(slug)) throw new Error(`Invalid slug: ${slug}`);
  const { videosDir, trashDir } = await getYtPaths();
  const trashedPath = path.join(trashDir, `${slug}-${trashedAt}.md`);
  const filePath = path.join(videosDir, `${slug}.md`);
  try {
    await fs.access(filePath);
    throw new Error(`Video ${slug} already exists — cannot restore`);
  } catch (e) {
    if (e instanceof Error && e.message.includes('already exists')) throw e;
    // ENOENT good
  }
  await fs.rename(trashedPath, filePath);
  await restoreCompanionsFromTrash(slug, trashedAt);
  logger.info('vault.restoreVideo', 'restored from trash', { slug });
  await recordEvents([
    { scope: 'video', event: 'restored', level: 'info', slug },
  ]);
  const video = await getVideo(slug);
  if (!video) throw new Error('Restore failed to materialize');
  return video;
}

export interface TrashItem {
  slug: string;
  trashedAt: number;
  title: string;
  fileName: string;
}

export async function listTrash(): Promise<TrashItem[]> {
  const { trashDir } = await getYtPaths();
  try {
    const files = await fs.readdir(trashDir);
    const items: TrashItem[] = [];
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const m = file.match(/^(.+)-(\d+)\.md$/);
      if (!m) continue;
      const [, slug, tsStr] = m;
      const trashedAt = Number(tsStr);
      try {
        const raw = await fs.readFile(path.join(trashDir, file), 'utf-8');
        const { data } = matter(raw);
        items.push({
          slug,
          trashedAt,
          title: (data.title as string) ?? slug,
          fileName: file,
        });
      } catch {
        continue;
      }
    }
    return items.sort((a, b) => b.trashedAt - a.trashedAt);
  } catch {
    return [];
  }
}

export async function purgeTrashItem(fileName: string): Promise<void> {
  if (!/^[a-z0-9-]+-\d+\.md$/.test(fileName)) throw new Error('Invalid fileName');
  const m = fileName.match(/^(.+)-(\d+)\.md$/);
  if (!m) throw new Error('Invalid fileName');
  const [, slug, tsStr] = m;
  const { trashDir } = await getYtPaths();
  const p = path.join(trashDir, fileName);
  await fs.unlink(p);
  await purgeCompanions(slug, tsStr);
  logger.info('vault.purgeTrashItem', 'purged', { fileName });
}

export async function getHubPages(): Promise<HubPage[]> {
  const { ytRoot } = await getYtPaths();
  const files = await listHubDocFiles();
  const pages: HubPage[] = [];
  for (const file of files) {
    try {
      const raw = await fs.readFile(path.join(ytRoot, file), 'utf-8');
      const { data, content } = matter(raw);
      const slug = toSlug(file);
      pages.push({
        slug,
        title: (data.title as string) || titleCaseFromSlug(slug),
        content,
        obsidianUri: buildObsidianUri(
          `1 - Rough Notes/Proyect Notes/YouTube/${slug}`
        ),
      });
    } catch {
      continue;
    }
  }
  // Surface canonical templates so they're editable from the app.
  const { templatesDir } = await getYtPaths();
  for (const t of TEMPLATE_DOCS) {
    try {
      const raw = await fs.readFile(path.join(templatesDir, t.fileName), 'utf-8');
      const { content } = matter(raw);
      pages.push({
        slug: t.slug,
        title: t.title,
        content,
        obsidianUri: templateObsidianUri(t),
      });
    } catch {
      continue;
    }
  }
  return pages;
}

export async function getHubPage(slug: string): Promise<HubPage | null> {
  // Templates routed first
  const tpl = isTemplateSlug(slug);
  if (tpl) {
    const { templatesDir } = await getYtPaths();
    const filePath = path.join(templatesDir, tpl.fileName);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const { content } = matter(raw);
      return {
        slug: tpl.slug,
        title: tpl.title,
        content,
        obsidianUri: templateObsidianUri(tpl),
      };
    } catch {
      return null;
    }
  }
  if (!isValidSlug(slug)) return null;
  if (HUB_EXCLUDE.has(`${slug}.md`)) return null;
  const { ytRoot } = await getYtPaths();
  const filePath = path.join(ytRoot, `${slug}.md`);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const { data, content } = matter(raw);
    return {
      slug,
      title: (data.title as string) || titleCaseFromSlug(slug),
      content,
      obsidianUri: buildObsidianUri(
        `1 - Rough Notes/Proyect Notes/YouTube/${slug}`
      ),
    };
  } catch {
    return null;
  }
}

export async function updateHubPage(slug: string, body: string): Promise<HubPage> {
  // Templates routed first
  const tpl = isTemplateSlug(slug);
  if (tpl) {
    const { templatesDir } = await getYtPaths();
    const filePath = path.join(templatesDir, tpl.fileName);
    const raw = await fs.readFile(filePath, 'utf-8');
    const { data } = matter(raw);
    const hadFrontmatter = raw.startsWith('---');
    const usesCRLF = /\r\n/.test(raw);
    const normalizedBody = usesCRLF
      ? body.replace(/\r?\n/g, '\r\n')
      : body.replace(/\r\n/g, '\n');
    const output = hadFrontmatter
      ? matter.stringify(normalizedBody, data)
      : normalizedBody;
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, output, 'utf-8');
    await fs.rename(tmp, filePath);
    logger.info('vault.updateHubPage', 'wrote template', { slug });
    return {
      slug: tpl.slug,
      title: tpl.title,
      content: body,
      obsidianUri: templateObsidianUri(tpl),
    };
  }

  if (!isValidSlug(slug)) throw new Error(`Invalid slug: ${slug}`);
  if (HUB_EXCLUDE.has(`${slug}.md`)) throw new Error(`Reserved doc: ${slug}`);
  const { ytRoot } = await getYtPaths();
  const filePath = path.join(ytRoot, `${slug}.md`);
  const raw = await fs.readFile(filePath, 'utf-8');
  const { data } = matter(raw);
  const hadFrontmatter = raw.startsWith('---');
  // Detect dominant line ending in the original file body so we can preserve
  // CRLF/LF style — otherwise saving from the app would churn every line on
  // CRLF-style vaults (e.g. files imported from Windows).
  const usesCRLF = /\r\n/.test(raw);
  const normalizedBody = usesCRLF
    ? body.replace(/\r?\n/g, '\r\n')
    : body.replace(/\r\n/g, '\n');
  const output = hadFrontmatter ? matter.stringify(normalizedBody, data) : normalizedBody;
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, output, 'utf-8');
  await fs.rename(tmp, filePath);
  logger.info('vault.updateHubPage', 'wrote', { slug });
  return {
    slug,
    title: (data.title as string) || titleCaseFromSlug(slug),
    content: body,
    obsidianUri: buildObsidianUri(
      `1 - Rough Notes/Proyect Notes/YouTube/${slug}`
    ),
  };
}
