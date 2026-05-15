import { NextRequest, NextResponse } from 'next/server';
import { listTrashedClips, purgeTrashedClip } from '@/lib/hub-vault';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await listTrashedClips();
  return NextResponse.json(items);
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const fileName = url.searchParams.get('file');
  if (!fileName) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  try {
    await purgeTrashedClip(fileName);
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('hub.trash.delete', 'failed', {
      fileName,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 });
  }
}
