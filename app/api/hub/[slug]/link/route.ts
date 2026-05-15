import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getClip, updateClip } from '@/lib/hub-vault';
import { isValidSlug } from '@/lib/schemas';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const LinkBodySchema = z.object({
  videoSlug: z.string(),
  action: z.enum(['link', 'unlink']),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = LinkBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { videoSlug, action } = parsed.data;
  if (!isValidSlug(videoSlug)) {
    return NextResponse.json({ error: 'Invalid videoSlug' }, { status: 400 });
  }
  const existing = await getClip(slug);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const set = new Set(existing.frontmatter.linked_video_slugs);
  if (action === 'link') set.add(videoSlug);
  else set.delete(videoSlug);
  try {
    const clip = await updateClip(slug, {
      frontmatter: { linked_video_slugs: Array.from(set) },
    });
    return NextResponse.json(clip);
  } catch (e) {
    logger.error('hub.link', 'failed', {
      slug,
      videoSlug,
      action,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
