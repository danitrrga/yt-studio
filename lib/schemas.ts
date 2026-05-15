import { z } from 'zod';

export const VideoStatusSchema = z.enum([
  'idea',
  'research',
  'scripting',
  'filming',
  'editing',
  'published',
]);

export const AudienceSchema = z.enum(['TOFU', 'MOFU', 'BOFU']);

export const ContentTypeSchema = z.enum(['long', 'short', 'community', 'live']);

// Date coercion: accept Date | string | null; output 'YYYY-MM-DD' string | null.
const DateOrNullSchema = z
  .union([z.date(), z.string(), z.null()])
  .nullish()
  .transform((v): string | null => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().split('T')[0];
    const trim = String(v).trim();
    if (!trim) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(trim)) return trim.slice(0, 10);
    return trim;
  });

// Permissive on read (passthrough unknowns — vault may still have stray legacy fields in a few files).
export const VideoFrontmatterSchema = z
  .object({
    title: z.string().default(''),
    status: VideoStatusSchema.default('idea'),
    content_type: ContentTypeSchema.default('long'),
    category: z.string().default(''),
    audience: AudienceSchema.default('TOFU'),
    tags: z.array(z.string()).default([]),
    linked_notes: z.array(z.string()).default([]),
    target_date: DateOrNullSchema,
    record_date: DateOrNullSchema,
    published_date: DateOrNullSchema,
    cycle: z.number().nullable().default(null),
    created: z
      .union([z.date(), z.string()])
      .optional()
      .transform((v): string => {
        if (!v) return new Date().toISOString().split('T')[0];
        if (v instanceof Date) return v.toISOString().split('T')[0];
        const s = String(v).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        return s;
      }),
  })
  .passthrough();

export type VideoFrontmatter = z.infer<typeof VideoFrontmatterSchema>;

// Coerce Date|string|null → 'YYYY-MM-DD'|null (no default — only runs when field is provided)
const DateCoerce = z
  .union([z.date(), z.string(), z.null()])
  .transform((v): string | null => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().split('T')[0];
    const s = String(v).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return s;
  });

// Strict schema for PUT payloads — every field optional, MUST NOT apply defaults.
const UpdateFrontmatterSchema = z
  .object({
    title: z.string().optional(),
    status: VideoStatusSchema.optional(),
    content_type: ContentTypeSchema.optional(),
    category: z.string().optional(),
    audience: AudienceSchema.optional(),
    tags: z.array(z.string()).optional(),
    linked_notes: z.array(z.string()).optional(),
    target_date: DateCoerce.optional(),
    record_date: DateCoerce.optional(),
    published_date: DateCoerce.optional(),
    cycle: z.number().nullable().optional(),
    created: z
      .union([z.date(), z.string()])
      .transform((v): string => {
        if (v instanceof Date) return v.toISOString().split('T')[0];
        return String(v);
      })
      .optional(),
  })
  .passthrough();

export const VideoUpdateSchema = z.object({
  frontmatter: UpdateFrontmatterSchema.optional(),
  body: z.string().optional(),
});

export type VideoUpdate = z.infer<typeof VideoUpdateSchema>;

export function parseVideoUpdate(raw: unknown): VideoUpdate {
  return VideoUpdateSchema.parse(raw);
}

// Slug validation — allowlist only safe chars. Prevents path traversal.
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/;

export function validateSlug(raw: string): string {
  if (!SLUG_REGEX.test(raw)) {
    throw new Error(`Invalid slug: ${raw}`);
  }
  return raw;
}

export function isValidSlug(raw: string): boolean {
  return SLUG_REGEX.test(raw);
}

// ───── Hub clips ────────────────────────────────────────────────

export const HubSourceSchema = z.enum(['youtube', 'article', 'tweet', 'podcast', 'other']);
export const HubClipStatusSchema = z.enum(['new', 'read', 'archived']);

export const HubClipFrontmatterSchema = z
  .object({
    title: z.string().default(''),
    url: z.string().url().or(z.string().min(1)),
    source: HubSourceSchema.default('other'),
    status: HubClipStatusSchema.default('new'),
    thumbnail: z.string().default(''),
    description: z.string().default(''),
    category: z.string().default(''),
    cycle: z.number().nullable().default(null),
    tags: z.array(z.string()).default([]),
    linked_video_slugs: z.array(z.string()).default([]),
    created_at: z
      .union([z.date(), z.string()])
      .optional()
      .transform((v): string => {
        if (!v) return new Date().toISOString();
        if (v instanceof Date) return v.toISOString();
        return String(v);
      }),
  })
  .passthrough();

export type HubClipFrontmatter = z.infer<typeof HubClipFrontmatterSchema>;

export const HubClipUpdateSchema = z
  .object({
    title: z.string().optional(),
    source: HubSourceSchema.optional(),
    status: HubClipStatusSchema.optional(),
    thumbnail: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    cycle: z.number().nullable().optional(),
    tags: z.array(z.string()).optional(),
    linked_video_slugs: z.array(z.string()).optional(),
  })
  .passthrough();

export const HubCaptureSchema = z.object({
  url: z.string().url(),
});

// ───── Telemetry ────────────────────────────────────────────────

export const TelemetryLevelSchema = z.enum(['info', 'warn', 'error']);

export const TelemetryScopeSchema = z.enum([
  'editor',
  'vault',
  'hub',
  'video',
  'thumbnail',
  'watcher',
  'route',
  'api',
]);

// Defensive: payload can hold arbitrary JSON keys, but we cap depth/size at write-time.
export const TelemetryEventSchema = z.object({
  ts: z.string().optional(), // server stamps if absent
  scope: TelemetryScopeSchema,
  event: z.string().min(1).max(64),
  level: TelemetryLevelSchema,
  slug: z.string().max(120).optional(),
  durationMs: z.number().nonnegative().max(600_000).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const TelemetryBatchSchema = z.union([
  TelemetryEventSchema,
  z.array(TelemetryEventSchema).max(50),
]);
