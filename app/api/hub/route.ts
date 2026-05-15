import { NextRequest, NextResponse } from 'next/server';
import { listClips, createClip, downloadImageForClip, listExistingSlugs } from '@/lib/hub-vault';
import { fetchUrlMeta, detectSource } from '@/lib/url-meta';
import { slugifyUrl } from '@/lib/slugify';
import { HubCaptureSchema } from '@/lib/schemas';
import { logger } from '@/lib/logger';
import { recordEvents } from '@/lib/telemetry-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const clips = await listClips();
  clips.sort((a, b) =>
    b.frontmatter.created_at.localeCompare(a.frontmatter.created_at)
  );
  return NextResponse.json(clips);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = HubCaptureSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }
  const { url } = parse.data;

  // Resolve a unique slug
  const existing = await listExistingSlugs();
  let slug = slugifyUrl(url);
  if (!slug) slug = `clip-${Date.now()}`;
  let n = 2;
  while (existing.has(slug)) {
    slug = `${slugifyUrl(url)}-${n++}`;
  }

  // Best-effort metadata fetch — never block the user
  let meta: Awaited<ReturnType<typeof fetchUrlMeta>>;
  try {
    meta = await fetchUrlMeta(url);
  } catch (e) {
    logger.warn('hub.capture', 'meta fetch failed', {
      url,
      error: e instanceof Error ? e.message : String(e),
    });
    meta = { title: '', description: '', image: '', source: detectSource(url) };
  }

  // Create the clip first so it's persisted even if image download fails
  const clip = await createClip({
    slug,
    title: meta.title || url,
    url,
    source: meta.source,
    description: meta.description,
    thumbnail: '',
  });

  // Image download is best-effort — patch frontmatter if successful
  if (meta.image) {
    const ext = await downloadImageForClip(slug, meta.image);
    if (ext) {
      // Mark thumbnail in frontmatter so the UI knows to probe locally
      const { updateClip } = await import('@/lib/hub-vault');
      await updateClip(slug, { frontmatter: { thumbnail: `${slug}.thumb.${ext}` } });
      clip.frontmatter.thumbnail = `${slug}.thumb.${ext}`;
    }
  }

  logger.info('hub.capture', 'created', { slug, source: meta.source, hasImage: !!meta.image });
  await recordEvents([
    {
      scope: 'hub',
      event: 'clip.captured',
      level: 'info',
      slug,
      payload: { source: meta.source, hadImage: !!meta.image },
    },
  ]);
  return NextResponse.json(clip, { status: 201 });
}
