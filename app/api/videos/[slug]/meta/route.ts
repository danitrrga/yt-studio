import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readVideoMeta, updateVideoMeta } from '@/lib/vault';
import { withApiErrors, BadRequestError, NotFoundError } from '@/lib/api-errors';
import { validateSlug } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ slug: string }> };

const SectionSchema = z.object({
  id: z.enum(['idea', 'production', 'publish', 'title_ideas', 'thumbnail_ideas', 'post_mortem']),
  heading: z.string(),
  body: z.string(),
});

const UpdateSchema = z.object({
  sections: z.array(SectionSchema).min(1),
});

export const GET = withApiErrors<Ctx>('api.videos.meta.get', async (_req, { params }) => {
  const { slug } = await params;
  try {
    validateSlug(slug);
  } catch (e) {
    throw new BadRequestError(e instanceof Error ? e.message : 'Invalid slug', 'INVALID_SLUG');
  }
  const meta = await readVideoMeta(slug);
  if (!meta) throw new NotFoundError(`Meta sidecar for ${slug} not found`);
  return NextResponse.json(meta);
});

export const PUT = withApiErrors<Ctx>('api.videos.meta.put', async (req, { params }) => {
  const { slug } = await params;
  try {
    validateSlug(slug);
  } catch (e) {
    throw new BadRequestError(e instanceof Error ? e.message : 'Invalid slug', 'INVALID_SLUG');
  }
  const raw = await req.json();
  const payload = UpdateSchema.parse(raw);
  const meta = await updateVideoMeta(slug, payload.sections);
  return NextResponse.json(meta);
});
