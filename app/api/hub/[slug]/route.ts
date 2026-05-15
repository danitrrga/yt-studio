import { NextRequest, NextResponse } from 'next/server';
import { getClip, updateClip, deleteClip } from '@/lib/hub-vault';
import { HubClipUpdateSchema } from '@/lib/schemas';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const clip = await getClip(slug);
  if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(clip);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = HubClipUpdateSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: 'Invalid update' }, { status: 400 });
  }
  try {
    const clip = await updateClip(slug, { frontmatter: parse.data });
    return NextResponse.json(clip);
  } catch (e) {
    logger.error('hub.patch', 'failed', {
      slug,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const result = await deleteClip(slug);
    return NextResponse.json(result);
  } catch (e) {
    logger.error('hub.delete', 'failed', {
      slug,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
