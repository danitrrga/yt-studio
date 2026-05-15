export type VideoStatus =
  | 'idea'
  | 'research'
  | 'scripting'
  | 'filming'
  | 'editing'
  | 'published';

export type Audience = 'TOFU' | 'MOFU' | 'BOFU';

export type ContentType = 'long' | 'short' | 'community' | 'live';

export interface VideoFrontmatter {
  title: string;
  status: VideoStatus;
  content_type: ContentType;
  category: string;
  audience: Audience;
  tags: string[];
  /** Wiki-link slugs to other notes (videos, hub clips, reference docs).
   *  Source of truth — `Video.links` is the same value, surfaced for the UI. */
  linked_notes: string[];
  target_date: string | null;
  record_date: string | null;
  published_date: string | null;
  cycle: number | null;
  created: string;
}

export interface Video {
  slug: string;
  frontmatter: VideoFrontmatter;
  body: string;
  /** Wiki-link slugs parsed out of a "## Links" body section. Read-only;
   *  surfaced in the script-page header alongside tags. The body the editor
   *  receives has the section stripped. */
  links: string[];
  obsidianUri: string;
  mtime: number;
}

export type VideoSummary = Omit<Video, 'body'>;

export type VideoMetaSectionId = 'idea' | 'production' | 'publish' | 'title_ideas' | 'thumbnail_ideas' | 'post_mortem';

export interface VideoMetaSection {
  id: VideoMetaSectionId;
  heading: string;
  body: string;
}

export interface VideoMeta {
  slug: string;
  sections: VideoMetaSection[];
  mtime: number;
}

export interface HubPage {
  slug: string;
  title: string;
  content: string;
  obsidianUri: string;
}

export type HubSource = 'youtube' | 'article' | 'tweet' | 'podcast' | 'other';

export type HubClipStatus = 'new' | 'read' | 'archived';

export interface HubClipFrontmatter {
  title: string;
  url: string;
  source: HubSource;
  status: HubClipStatus;
  thumbnail: string; // local filename in clip dir, OR full http(s)// URL, OR '' if none
  description: string;
  category: string;
  cycle: number | null;
  tags: string[];
  linked_video_slugs: string[];
  created_at: string; // ISO
}

export interface HubClip {
  slug: string;
  frontmatter: HubClipFrontmatter;
  body: string;
  obsidianUri: string;
  mtime: number;
}

export type HubClipSummary = Omit<HubClip, 'body'>;

export interface FileChangeEvent {
  type: 'change' | 'add' | 'unlink';
  slug: string;
}

// ───── Telemetry ────────────────────────────────────────────────

export type TelemetryLevel = 'info' | 'warn' | 'error';

export type TelemetryScope =
  | 'editor'
  | 'vault'
  | 'hub'
  | 'video'
  | 'thumbnail'
  | 'watcher'
  | 'route'
  | 'api';

export interface TelemetryEvent {
  ts: string; // ISO 8601
  scope: TelemetryScope;
  event: string;
  level: TelemetryLevel;
  slug?: string;
  durationMs?: number;
  payload?: Record<string, unknown>;
}

export interface TelemetrySummaryWindow {
  window: '24h' | '7d' | '30d';
  computedAt: string;
  counters: {
    saves: number;
    saveFails: number;
    conflicts: number;
    autoMerges: number;
    clips: number;
    converts: number;
    uploads: number;
    crashes: number;
  };
  sparklines: {
    saves: number[];
    fails: number[];
    conflicts: number[];
    clips: number[];
  };
}
