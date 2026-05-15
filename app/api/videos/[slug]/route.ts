import { NextResponse } from 'next/server';
import { getVideo, updateVideo, deleteVideo } from '@/lib/vault';
import { withApiErrors, BadRequestError, NotFoundError } from '@/lib/api-errors';
import { parseVideoUpdate, validateSlug } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ slug: string }> };

export const GET = withApiErrors<Ctx>('api.videos.get', async (_req, { params }) => {
  const { slug } = await params;
  try {
    validateSlug(slug);
  } catch (e) {
    throw new BadRequestError(e instanceof Error ? e.message : 'Invalid slug', 'INVALID_SLUG');
  }
  const video = await getVideo(slug);
  if (!video) throw new NotFoundError(`Video ${slug} not found`);
  return NextResponse.json(video);
});

export const DELETE = withApiErrors<Ctx>('api.videos.delete', async (_req, { params }) => {
  const { slug } = await params;
  try {
    validateSlug(slug);
  } catch (e) {
    throw new BadRequestError(e instanceof Error ? e.message : 'Invalid slug', 'INVALID_SLUG');
  }
  try {
    const result = await deleteVideo(slug);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Error && e.message.includes('not found')) {
      throw new NotFoundError(e.message);
    }
    throw e;
  }
});

export const PUT = withApiErrors<Ctx>('api.videos.put', async (req, { params }) => {
  const { slug } = await params;
  try {
    validateSlug(slug);
  } catch (e) {
    throw new BadRequestError(e instanceof Error ? e.message : 'Invalid slug', 'INVALID_SLUG');
  }
  const raw = await req.json();
  const payload = parseVideoUpdate(raw); // throws ZodError → 400 via wrapper
  const video = await updateVideo(slug, payload);
  return NextResponse.json(video);
});

