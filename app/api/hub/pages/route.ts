import { NextResponse } from 'next/server';
import { getHubPages } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET() {
  const pages = await getHubPages();
  return NextResponse.json(pages);
}
