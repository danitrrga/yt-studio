import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { findClipThumbnail } from '@/lib/hub-vault';

export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const found = await findClipThumbnail(slug);
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const data = await fs.readFile(found.path);
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': MIME[found.ext] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
