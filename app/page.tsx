'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/hooks/use-settings';
import {
  format,
  parseISO,
  differenceInCalendarDays,
  isToday,
  isTomorrow,
  isThisWeek,
} from 'date-fns';
import {
  ArrowRight,
  Target,
  Film,
  Plus,
  PenLine,
  Camera,
  AlertTriangle,
  ChevronRight,
  Library,
} from 'lucide-react';
import { useVideos } from '@/hooks/use-videos';
import { useHubClips } from '@/hooks/use-hub';
import { thumbnailSrc } from '@/components/hub/hub-utils';
import { useUI } from '@/components/UIProvider';
import { STATUS_COLOR_VAR, IN_FLIGHT_STATUSES } from '@/lib/status';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { VideoSummary, HubClipSummary } from '@/lib/types';

function fmtDate(d: string | null) {
  if (!d) return '—';
  try {
    return format(parseISO(d), 'MMM d');
  } catch {
    return d;
  }
}

function fmtRelative(d: string | null): string | null {
  if (!d) return null;
  try {
    const date = parseISO(d);
    if (isToday(date)) return 'today';
    if (isTomorrow(date)) return 'tomorrow';
    const diff = differenceInCalendarDays(date, new Date());
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    if (diff < 7) return `in ${diff}d`;
    if (isThisWeek(date)) return format(date, 'EEEE');
    return format(date, 'MMM d');
  } catch {
    return d;
  }
}

/** Resolve the visible date pair according to the user's `dateFormat` setting. */
function resolveDate(
  d: string | null,
  format: 'relative' | 'absolute' | 'both'
): { primary: string; secondary: string | null } {
  if (!d) return { primary: '—', secondary: null };
  const abs = fmtDate(d);
  const rel = fmtRelative(d);
  if (format === 'absolute') return { primary: abs, secondary: null };
  if (format === 'relative') return { primary: rel ?? abs, secondary: null };
  return { primary: abs, secondary: rel };
}

function daysUntil(d: string | null) {
  if (!d) return null;
  try {
    return differenceInCalendarDays(parseISO(d), new Date());
  } catch {
    return null;
  }
}

export default function Home() {
  const { videos, isLoading } = useVideos();
  const { clips } = useHubClips();
  const { setQuickAddOpen } = useUI();
  const { settings } = useSettings();
  const router = useRouter();

  // Default-landing redirect — fires once after settings hydrate.
  useEffect(() => {
    if (settings.defaultLanding !== '/') {
      router.replace(settings.defaultLanding);
    }
  }, [settings.defaultLanding, router]);

  const today = useMemo(() => new Date(), []);

  const newClips = useMemo(() => {
    return (clips ?? [])
      .filter((c) => c.frontmatter.status === 'new')
      .sort((a, b) =>
        b.frontmatter.created_at.localeCompare(a.frontmatter.created_at)
      );
  }, [clips]);

  const inFlight = useMemo(() => {
    if (!videos) return [];
    return videos.filter((v) => IN_FLIGHT_STATUSES.includes(v.frontmatter.status));
  }, [videos]);

  const nowWorkingOn = useMemo(() => {
    const sorted = [...inFlight].sort((a, b) => {
      switch (settings.nowWorkingRule) {
        case 'soonest_record': {
          const ad = a.frontmatter.record_date ?? '9999-12-31';
          const bd = b.frontmatter.record_date ?? '9999-12-31';
          return ad.localeCompare(bd);
        }
        case 'latest_edited': {
          // mtime is server-supplied; higher = more recent → put first
          return b.mtime - a.mtime;
        }
        case 'soonest_target':
        default: {
          const ad = a.frontmatter.target_date ?? '9999-12-31';
          const bd = b.frontmatter.target_date ?? '9999-12-31';
          return ad.localeCompare(bd);
        }
      }
    });
    return sorted[0] ?? null;
  }, [inFlight, settings.nowWorkingRule]);

  const writingThisWeek = useMemo(() => {
    return inFlight
      .filter((v) => v.frontmatter.status === 'scripting')
      .filter((v) => {
        const d = daysUntil(v.frontmatter.target_date);
        return d !== null && d <= 7;
      })
      .sort((a, b) =>
        (a.frontmatter.target_date ?? '').localeCompare(b.frontmatter.target_date ?? '')
      );
  }, [inFlight]);

  const comingToRecord = useMemo(() => {
    return (videos ?? [])
      .filter((v) => v.frontmatter.status !== 'published')
      .filter((v) => {
        const d = daysUntil(v.frontmatter.record_date);
        return d !== null && d >= 0 && d <= 14;
      })
      .sort((a, b) =>
        (a.frontmatter.record_date ?? '').localeCompare(b.frontmatter.record_date ?? '')
      );
  }, [videos]);

  const overdue = useMemo(() => {
    return (videos ?? [])
      .filter((v) => v.frontmatter.status !== 'published')
      .filter((v) => {
        const d = daysUntil(v.frontmatter.target_date);
        return d !== null && d < 0;
      })
      .sort((a, b) =>
        (a.frontmatter.target_date ?? '').localeCompare(b.frontmatter.target_date ?? '')
      );
  }, [videos]);

  return (
    <div className="px-8 py-6 space-y-12 max-w-[1280px] mx-auto">
      {/* Hero */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.012em] leading-[1.2]">
            Today, {format(today, 'EEEE MMM d')}
          </h1>
          {!isLoading && (
            <p className="text-[13px] text-[var(--color-fg-muted)] mt-2">
              {inFlight.length === 0 ? (
                'Nothing in flight.'
              ) : (
                <>
                  {inFlight.length} in flight
                  {overdue.length > 0 && (
                    <>
                      {', '}
                      <span className="text-[hsl(var(--color-overdue))] font-medium">
                        {overdue.length} overdue
                      </span>
                    </>
                  )}
                  .
                </>
              )}
            </p>
          )}
        </div>
        <button
          onClick={() => setQuickAddOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md bg-[var(--color-button-primary)] text-[var(--color-button-primary-fg)] text-[13px] font-medium hover:bg-[var(--color-button-primary-hover)]"
        >
          <Plus className="w-4 h-4" />
          New video
          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-black/10 text-[10px] font-mono">
            C
          </span>
        </button>
      </div>

      {isLoading && (
        <div className="rounded-xl border bg-[var(--color-surface)] p-6">
          <Skeleton variant="row" count={3} />
        </div>
      )}

      {!isLoading && (
        <>
          {/* Now working on */}
          {nowWorkingOn ? (
            <NowWorkingCard video={nowWorkingOn} dateFormat={settings.dateFormat} />
          ) : (
            <EmptyState
              icon={Film}
              title="Nothing in production"
              body="Start a new video — ideas, scripts, and shoots land here."
              cta={{
                label: 'New video',
                shortcut: ['C'],
                onClick: () => setQuickAddOpen(true),
              }}
            />
          )}

          {/* Overdue strip — full-width, only renders when there's something to fix */}
          {overdue.length > 0 && <OverdueStrip videos={overdue} />}

          {/* Planning band — what's coming up */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FocusColumn
              title="Writing this week"
              icon={PenLine}
              videos={writingThisWeek}
              dateField="target_date"
              empty="No drafts due in 7d."
            />
            <FocusColumn
              title="Coming up to record"
              icon={Camera}
              videos={comingToRecord}
              dateField="record_date"
              empty="No record dates in 14d."
            />
          </div>

          {/* Recent clips — only renders when there are unread clips */}
          {newClips.length > 0 && <RecentClipsSection clips={newClips} />}
        </>
      )}
    </div>
  );
}

function NowWorkingCard({
  video,
  dateFormat,
}: {
  video: VideoSummary;
  dateFormat: 'relative' | 'absolute' | 'both';
}) {
  const days = daysUntil(video.frontmatter.target_date);
  const overdue = days !== null && days < 0;
  const plan = resolveDate(video.frontmatter.target_date, dateFormat);
  const record = resolveDate(video.frontmatter.record_date, dateFormat);
  const published = resolveDate(video.frontmatter.published_date, dateFormat);

  return (
    <section>
      <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-fg-muted)] mb-3">
        Now working on
      </h2>
      <div className="rounded-xl border bg-[var(--color-surface)] p-5 hover:bg-[var(--color-surface-hover)] transition-colors">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <Link
              href={`/videos/${video.slug}`}
              className="text-[20px] font-semibold tracking-[-0.01em] leading-[1.3] line-clamp-2 hover:underline"
            >
              {video.frontmatter.title || video.slug}
            </Link>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <StatusBadge status={video.frontmatter.status} />
            </div>
            <div className="mt-4 flex items-center gap-4 flex-wrap text-[13px]">
              {video.frontmatter.target_date && (
                <DateLine
                  icon={Target}
                  label="Plan"
                  value={plan.primary}
                  hint={plan.secondary}
                  warn={overdue}
                />
              )}
              {video.frontmatter.record_date && (
                <DateLine
                  icon={Camera}
                  label="Record"
                  value={record.primary}
                  hint={record.secondary}
                />
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Link
              href={`/videos/${video.slug}/script`}
              className="inline-flex items-center justify-center gap-1.5 px-3 h-8 rounded-md bg-[var(--color-button-primary)] text-[var(--color-button-primary-fg)] text-[13px] font-medium hover:bg-[var(--color-button-primary-hover)]"
            >
              <PenLine className="w-4 h-4" />
              Open script
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function DateLine({
  icon: Icon,
  label,
  value,
  hint,
  warn,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string | null;
  warn?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 ${
        warn ? 'text-[hsl(var(--color-overdue))]' : 'text-[var(--color-fg-secondary)]'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[var(--color-fg-muted)]">{label}</span>
      <span className="font-medium text-[var(--color-fg)]">{value}</span>
      {hint && (
        <span className={warn ? '' : 'text-[var(--color-fg-muted)]'}>· {hint}</span>
      )}
    </div>
  );
}

function FocusColumn({
  title,
  icon: Icon,
  videos,
  dateField,
  empty,
}: {
  title: string;
  icon: React.ElementType;
  videos: VideoSummary[];
  dateField: 'target_date' | 'record_date';
  empty: string;
}) {
  return (
    <section className="rounded-lg border bg-[var(--color-surface)] flex flex-col">
      <div className="flex items-center gap-2 px-4 h-10 border-b">
        <Icon className="w-3.5 h-3.5 text-[var(--fg-muted)]" />
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
          {title}
        </span>
        <span className="ml-auto text-[11px] tabular-nums text-[var(--color-fg-muted)]">
          {videos.length}
        </span>
      </div>
      {videos.length === 0 ? (
        <div className="px-4 py-6 text-xs text-[var(--color-fg-muted)] text-center">
          {empty}
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border-subtle)]">
          {videos.slice(0, 5).map((v) => (
            <FocusRow key={v.slug} video={v} dateField={dateField} />
          ))}
          {videos.length > 5 && (
            <Link
              href="/videos"
              className="block px-4 py-2 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] text-center"
            >
              +{videos.length - 5} more
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function FocusRow({
  video,
  dateField,
  warn,
  hoverClass = 'hover:bg-[var(--color-surface-hover)]',
}: {
  video: VideoSummary;
  dateField: 'target_date' | 'record_date';
  warn?: boolean;
  hoverClass?: string;
}) {
  const dateValue = video.frontmatter[dateField];
  const days = daysUntil(dateValue);
  return (
    <Link
      href={`/videos/${video.slug}`}
      className={`flex items-center gap-3 px-4 py-2.5 transition-colors duration-[120ms] ${hoverClass} group`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: `hsl(var(${STATUS_COLOR_VAR[video.frontmatter.status]}))` }}
      />
      <div className="min-w-0 flex-1 text-[13px] font-medium line-clamp-1">
        {video.frontmatter.title || video.slug}
      </div>
      {dateValue && (
        <div className={`text-[12px] tabular-nums shrink-0 ${
          warn ? 'text-[hsl(var(--color-overdue))]' : 'text-[var(--color-fg-muted)]'
        }`}>
          {fmtDate(dateValue)}
          {days !== null && (
            <>
              {' · '}
              {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'today' : `in ${days}d`}
            </>
          )}
        </div>
      )}
      <ChevronRight className="w-3.5 h-3.5 text-[var(--color-fg-muted)] opacity-30 group-hover:opacity-100 transition-opacity duration-[120ms] shrink-0" />
    </Link>
  );
}

function OverdueStrip({ videos }: { videos: VideoSummary[] }) {
  const top = videos.slice(0, 5);
  const more = videos.length - top.length;
  return (
    <section>
      <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-fg-muted)] mb-3 inline-flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3 text-[hsl(var(--color-overdue))]" />
        Overdue
        <span className="tabular-nums text-[var(--color-fg-muted)]">· {videos.length}</span>
      </h2>
      <div className="rounded-xl border border-l-2 border-l-[hsl(var(--color-overdue))] bg-[hsl(var(--color-overdue)/0.04)] divide-y divide-[var(--color-border-subtle)] overflow-hidden">
        {top.map((v) => (
          <FocusRow
            key={v.slug}
            video={v}
            dateField="target_date"
            warn
            hoverClass="hover:bg-[hsl(var(--color-overdue)/0.08)]"
          />
        ))}
        {more > 0 && (
          <div className="block px-5 py-2.5 text-[12px] text-[var(--color-fg-muted)] text-center">
            +{more} more
          </div>
        )}
      </div>
    </section>
  );
}

function RecentClipsSection({ clips }: { clips: HubClipSummary[] }) {
  const top = clips.slice(0, 6);
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-fg-muted)] inline-flex items-center gap-1.5">
          <Library className="w-3 h-3" />
          Inbox · {clips.length} new clip{clips.length === 1 ? '' : 's'}
        </h2>
        <Link
          href="/hub"
          className="text-[11px] text-[var(--color-fg-secondary)] hover:text-[var(--color-fg)] inline-flex items-center gap-1"
        >
          All clips <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {top.map((clip) => {
          const thumb = thumbnailSrc(clip);
          return (
            <Link
              key={clip.slug}
              href={`/hub/${clip.slug}`}
              className="group rounded-lg border bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors overflow-hidden flex"
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb}
                  alt=""
                  className="w-24 aspect-video object-cover bg-[var(--color-surface-elevated)] shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-24 aspect-video flex items-center justify-center bg-[var(--color-surface-elevated)] shrink-0">
                  <Library className="w-4 h-4 text-[var(--color-fg-muted)]" />
                </div>
              )}
              <div className="p-2.5 flex-1 min-w-0 flex flex-col gap-1">
                <div className="text-sm font-medium line-clamp-2 leading-snug">
                  {clip.frontmatter.title || clip.frontmatter.url}
                </div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] mt-auto">
                  {clip.frontmatter.source}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

