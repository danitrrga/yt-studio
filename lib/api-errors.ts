import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from './logger';

export type RouteHandler<Ctx = unknown> = (req: Request, ctx: Ctx) => Promise<Response> | Response;

export function withApiErrors<Ctx = unknown>(scope: string, handler: RouteHandler<Ctx>): RouteHandler<Ctx> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ZodError) {
        logger.warn(scope, 'validation error', { issues: err.issues });
        return NextResponse.json({ error: 'Invalid input', issues: err.issues, code: 'VALIDATION' }, { status: 400 });
      }
      if (err instanceof BadRequestError) {
        logger.warn(scope, err.message, err.details);
        return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
      }
      if (err instanceof NotFoundError) {
        return NextResponse.json({ error: err.message, code: 'NOT_FOUND' }, { status: 404 });
      }
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error(scope, msg, { stack: err instanceof Error ? err.stack : undefined });
      return NextResponse.json({ error: msg, code: 'INTERNAL' }, { status: 500 });
    }
  };
}

export class BadRequestError extends Error {
  code: string;
  details?: unknown;
  constructor(message: string, code: string = 'BAD_REQUEST', details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Not found') {
    super(message);
  }
}
