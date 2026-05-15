import { NextRequest, NextResponse } from 'next/server';
import { searchCorpus } from '@/lib/search';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  if (q.trim().length < 2) {
    return NextResponse.json({ videos: [], clips: [], docs: [], query: '' });
  }
  const result = await searchCorpus(q);
  return NextResponse.json(result);
}
