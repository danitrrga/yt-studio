import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updateClip } from '@/lib/hub-vault';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const NotesBodySchema = z.object({ body: z.string() });

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
  const parsed = NotesBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  try {
    const clip = await updateClip(slug, { body: parsed.data.body });
    return NextResponse.json(clip);
  } catch (e) {
    logger.error('hub.notes.put', 'failed', {
      slug,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
