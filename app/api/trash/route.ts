import { NextResponse } from 'next/server';
import { listTrash, purgeTrashItem } from '@/lib/vault';
import { withApiErrors, BadRequestError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

export const GET = withApiErrors('api.trash.list', async () => {
  const items = await listTrash();
  return NextResponse.json(items);
});

export const DELETE = withApiErrors('api.trash.purge', async (req) => {
  const url = new URL(req.url);
  const fileName = url.searchParams.get('file');
  if (!fileName) throw new BadRequestError('missing file', 'MISSING_FILE');
  await purgeTrashItem(fileName);
  return NextResponse.json({ ok: true });
});
