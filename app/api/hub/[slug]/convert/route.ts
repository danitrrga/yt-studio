import { NextRequest, NextResponse } from 'next/server';
import { getClip, updateClip } from '@/lib/hub-vault';
import { createVideo, updateVideo } from '@/lib/vault';
import { slugify } from '@/lib/slugify';
import { logger } from '@/lib/logger';
import { recordEvents } from '@/lib/telemetry-store';

export const dynamic = 'force-dynamic';

function buildIdeaSection(title: string, url: string, notes: string): string {
  const trimmed = notes.trim();
  return [
    `## Idea`,
    '',
    `**Source:** ${url}`,
    '',
    title.trim() ? title : '(untitled clip)',
    trimmed ? `\n${trimmed}` : '',
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const clip = await getClip(slug);
  if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Build a unique video slug from the clip title (or fall back to slug)
  const baseSeed = clip.frontmatter.title || slug;
  let videoSlug = slugify(baseSeed).slice(0, 60) || `clip-${Date.now()}`;
  let video;
  let n = 2;
  while (true) {
    try {
      video = await createVideo({
        slug: videoSlug,
        title: clip.frontmatter.title || baseSeed,
      });
      break;
    } catch (e) {
      if (e instanceof Error && e.message.includes('already exists')) {
        videoSlug = `${slugify(baseSeed).slice(0, 56)}-${n++}`;
        if (n > 50) {
          return NextResponse.json({ error: 'Slug exhausted' }, { status: 500 });
        }
        continue;
      }
      logger.error('hub.convert', 'createVideo failed', {
        slug,
        error: e instanceof Error ? e.message : String(e),
      });
      return NextResponse.json({ error: 'Convert failed' }, { status: 500 });
    }
  }

  // Seed the new video body with an Idea section pulled from the clip
  const seededBody = buildIdeaSection(
    clip.frontmatter.title,
    clip.frontmatter.url,
    clip.body
  );
  try {
    await updateVideo(videoSlug, { body: seededBody });
  } catch (e) {
    logger.warn('hub.convert', 'seed body failed (non-fatal)', {
      slug: videoSlug,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Auto-link the clip to the new video
  try {
    const set = new Set(clip.frontmatter.linked_video_slugs);
    set.add(videoSlug);
    await updateClip(slug, {
      frontmatter: { linked_video_slugs: Array.from(set) },
    });
  } catch (e) {
    logger.warn('hub.convert', 'autolink failed (non-fatal)', {
      slug,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  logger.info('hub.convert', 'created video from clip', { clip: slug, video: videoSlug });
  await recordEvents([
    {
      scope: 'hub',
      event: 'clip.converted',
      level: 'info',
      slug,
      payload: { videoSlug },
    },
  ]);
  return NextResponse.json({ videoSlug });
}
