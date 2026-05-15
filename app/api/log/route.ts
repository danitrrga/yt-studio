import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (Array.isArray(body?.entries)) {
      for (const entry of body.entries) {
        if (entry && typeof entry === 'object') {
          logger.info(`client.${entry.scope ?? 'unknown'}`, String(entry.msg ?? ''), entry.data);
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
