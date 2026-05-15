import { NextRequest, NextResponse } from 'next/server';
import { summarize, invalidateSummaryCache } from '@/lib/telemetry-store';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const windowParam = url.searchParams.get('window') ?? '24h';
  const fresh = url.searchParams.get('fresh') === '1';
  const window =
    windowParam === '7d' || windowParam === '30d' ? windowParam : '24h';
  try {
    if (fresh) invalidateSummaryCache();
    const result = await summarize(window);
    return NextResponse.json(result);
  } catch (e) {
    logger.error('api.events.summary', 'failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: 'Summary failed' }, { status: 500 });
  }
}
