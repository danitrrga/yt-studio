import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { findThumbnailPath, writeThumbnail, deleteThumbnail, type ThumbnailExt } from '@/lib/vault';
import { withApiErrors, BadRequestError, NotFoundError } from '@/lib/api-errors';
import { validateSlug } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ slug: string }> };

const MIME_TO_EXT: Record<string, ThumbnailExt> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const EXT_TO_MIME: Record<ThumbnailExt, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export const GET = withApiErrors<Ctx>('api.videos.thumbnail.get', async (_req, { params }) => {
  const { slug } = await params;
  try {
    validateSlug(slug);
  } catch {
    throw new BadRequestError('Invalid slug', 'INVALID_SLUG');
  }
  const found = await findThumbnailPath(slug);
  if (!found) throw new NotFoundError(`No thumbnail for ${slug}`);
  const data = await fs.readFile(found.path);
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': EXT_TO_MIME[found.ext],
      'Cache-Control': 'no-cache',
    },
  });
});

export const POST = withApiErrors<Ctx>('api.videos.thumbnail.post', async (req, { params }) => {
  const { slug } = await params;
  try {
    validateSlug(slug);
  } catch {
    throw new BadRequestError('Invalid slug', 'INVALID_SLUG');
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    throw new BadRequestError('Missing file', 'MISSING_FILE');
  }
  if (file.size > MAX_BYTES) {
    throw new BadRequestError(`File exceeds ${MAX_BYTES / 1024 / 1024}MB`, 'TOO_LARGE');
  }
  const ext = MIME_TO_EXT[file.type];
  if (!ext) {
    throw new BadRequestError(
      `Unsupported type ${file.type} — allow jpg/png/webp`,
      'UNSUPPORTED_TYPE'
    );
  }
  const buf = Buffer.from(await file.arrayBuffer());
  await writeThumbnail(slug, ext, buf);
  return NextResponse.json({ slug, ext, bytes: buf.length });
});

export const DELETE = withApiErrors<Ctx>('api.videos.thumbnail.delete', async (_req, { params }) => {
  const { slug } = await params;
  try {
    validateSlug(slug);
  } catch {
    throw new BadRequestError('Invalid slug', 'INVALID_SLUG');
  }
  const removed = await deleteThumbnail(slug);
  if (!removed) throw new NotFoundError(`No thumbnail for ${slug}`);
  return NextResponse.json({ slug, removed: true });
});
