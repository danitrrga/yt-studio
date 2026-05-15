import { NextRequest, NextResponse } from 'next/server';
import { getHubPage, updateHubPage } from '@/lib/vault';
import { z } from 'zod';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const UpdateBodySchema = z.object({ body: z.string() });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const page = await getHubPage(slug);
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(page);
}

export async function PUT(
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
  const parsed = UpdateBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  try {
    const page = await updateHubPage(slug, parsed.data.body);
    return NextResponse.json(page);
  } catch (e) {
    logger.error('hub.pages.put', 'failed', {
      slug,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
