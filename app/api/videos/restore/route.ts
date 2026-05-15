import { NextResponse } from 'next/server';
import { z } from 'zod';
import { restoreVideo } from '@/lib/vault';
import { withApiErrors, BadRequestError } from '@/lib/api-errors';
import { validateSlug } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

const RestoreSchema = z.object({
  slug: z.string(),
  trashedAt: z.number(),
});

export const POST = withApiErrors('api.videos.restore', async (req) => {
  const raw = await req.json();
  const input = RestoreSchema.parse(raw);
  try {
    validateSlug(input.slug);
  } catch {
    throw new BadRequestError('Invalid slug', 'INVALID_SLUG');
  }
  const video = await restoreVideo(input.slug, input.trashedAt);
  return NextResponse.json(video);
});
