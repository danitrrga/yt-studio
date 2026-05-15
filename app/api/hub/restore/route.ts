import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { restoreClip } from '@/lib/hub-vault';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const RestoreSchema = z.object({
  slug: z.string(),
  trashedAt: z.number(),
});

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = RestoreSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  try {
    const clip = await restoreClip(parsed.data.slug, parsed.data.trashedAt);
    return NextResponse.json(clip);
  } catch (e) {
    if (e instanceof Error && e.message.includes('already exists')) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    logger.error('hub.restore', 'failed', {
      slug: parsed.data.slug,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 });
  }
}
