import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  describeRootPath,
  setYtConfig,
  ensureYtStructure,
  validateRootPath,
} from '@/lib/yt-config';
import { withApiErrors, BadRequestError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

export const GET = withApiErrors('api.config.yt-path.get', async () => {
  const info = await describeRootPath();
  return NextResponse.json(info);
});

const PutSchema = z.object({
  rootPath: z.string().min(1).max(512),
});

export const PUT = withApiErrors('api.config.yt-path.put', async (req) => {
  const raw = await req.json();
  const parsed = PutSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.issues[0]?.message ?? 'Invalid body', 'INVALID_BODY');
  }

  const { rootPath } = parsed.data;
  try {
    validateRootPath(rootPath);
  } catch (e) {
    throw new BadRequestError(e instanceof Error ? e.message : 'Invalid rootPath', 'INVALID_PATH');
  }

  await setYtConfig({ rootPath });
  await ensureYtStructure(rootPath);

  const info = await describeRootPath();
  return NextResponse.json({
    ...info,
    message: 'Path updated. Reload the app to apply.',
  });
});
