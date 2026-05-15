import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getVideos, createVideo } from '@/lib/vault';
import { withApiErrors, BadRequestError } from '@/lib/api-errors';
import { VideoStatusSchema, AudienceSchema, validateSlug } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export const GET = withApiErrors('api.videos.list', async () => {
  const videos = await getVideos();
  return NextResponse.json(videos);
});

const CreateSchema = z.object({
  slug: z.string(),
  title: z.string().min(1, 'Title is required'),
  status: VideoStatusSchema.optional(),
  target_date: z.string().nullable().optional(),
  audience: AudienceSchema.optional(),
});

export const POST = withApiErrors('api.videos.create', async (req) => {
  const raw = await req.json();
  const input = CreateSchema.parse(raw);
  try {
    validateSlug(input.slug);
  } catch {
    throw new BadRequestError('Invalid slug — use a-z, 0-9, and hyphens', 'INVALID_SLUG');
  }
  try {
    const video = await createVideo(input);
    return NextResponse.json(video, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message.includes('already exists')) {
      return NextResponse.json({ error: e.message, code: 'DUPLICATE' }, { status: 409 });
    }
    throw e;
  }
});
