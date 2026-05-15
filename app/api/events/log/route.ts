import { NextRequest, NextResponse } from 'next/server';
import { TelemetryBatchSchema } from '@/lib/schemas';
import { recordEvents, queryEvents } from '@/lib/telemetry-store';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = TelemetryBatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
  }
  const events = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  try {
    await recordEvents(events);
  } catch (e) {
    logger.warn('api.events.log.post', 'append failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: 'Append failed' }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const since = url.searchParams.get('since');
  const until = url.searchParams.get('until');
  const scope = url.searchParams.get('scope') ?? undefined;
  const level = url.searchParams.get('level') ?? undefined;
  const search = url.searchParams.get('search') ?? undefined;
  const limit = url.searchParams.get('limit');
  try {
    const events = await queryEvents({
      since: since ? new Date(since) : undefined,
      until: until ? new Date(until) : undefined,
      scope: scope ?? undefined,
      level: level ?? undefined,
      search,
      limit: limit ? Number(limit) : undefined,
    });
    return NextResponse.json(events);
  } catch (e) {
    logger.error('api.events.log.get', 'query failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }
}
