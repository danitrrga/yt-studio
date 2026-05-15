'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Target, Video as VideoIcon, CheckCircle2, Link2 } from 'lucide-react';
import type { Audience, Video } from '@/lib/types';
import { updateVideoField, useVideos } from '@/hooks/use-videos';
import { useHubClips } from '@/hooks/use-hub';
import { StatusPill } from '@/components/ui/StatusPill';
import { DateChip } from './DateChip';
import { PropChip } from './PropChip';

const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: 'TOFU', label: 'TOFU — top of funnel' },
  { value: 'MOFU', label: 'MOFU — middle' },
  { value: 'BOFU', label: 'BOFU — bottom' },
];

export function PropStrip({
  video,
  onMutate,
}: {
  video: Video;
  onMutate: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const targetOverdue =
    !!video.frontmatter.target_date &&
    video.frontmatter.target_date < today &&
    video.frontmatter.status !== 'published';

  const { videos } = useVideos();
  const { clips } = useHubClips();

  const videoSlugs = useMemo(
    () => new Set((videos ?? []).map((v) => v.slug)),
    [videos]
  );
  const clipSlugs = useMemo(
    () => new Set((clips ?? []).map((c) => c.slug)),
    [clips]
  );

  const resolveLink = (slug: string): string => {
    if (videoSlugs.has(slug)) return `/videos/${slug}`;
    if (clipSlugs.has(slug)) return `/hub/${slug}`;
    return `/hub/${slug}`;
  };

  const saveField = (field: string) => async (next: unknown) => {
    await updateVideoField(video.slug, { [field]: next });
    onMutate();
  };

  return (
    <div className="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[var(--color-border-subtle)] -mx-1 px-1 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <StatusPill status={video.frontmatter.status} />

        <DateChip
          label="Plan"
          icon={Target}
          date={video.frontmatter.target_date}
          onChange={saveField('target_date')}
          overdue={targetOverdue}
        />
        <DateChip
          label="Record"
          icon={VideoIcon}
          date={video.frontmatter.record_date}
          onChange={saveField('record_date')}
        />
        <DateChip
          label="Published"
          icon={CheckCircle2}
          date={video.frontmatter.published_date}
          onChange={saveField('published_date')}
        />

        <PropChip
          label="Cycle"
          value={video.frontmatter.cycle}
          display={`Cycle ${video.frontmatter.cycle}`}
          emptyLabel="+ Cycle"
          config={{ kind: 'number', min: 1 }}
          onSave={saveField('cycle')}
        />

        <PropChip
          label="Category"
          value={video.frontmatter.category}
          display={video.frontmatter.category}
          emptyLabel="+ Category"
          config={{ kind: 'text', placeholder: 'Productivity' }}
          onSave={saveField('category')}
        />

        <PropChip
          label="Audience"
          value={video.frontmatter.audience}
          display={video.frontmatter.audience}
          emptyLabel="+ Audience"
          config={{ kind: 'select', options: AUDIENCE_OPTIONS }}
          onSave={saveField('audience')}
        />

        {video.frontmatter.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap ml-1">
            {video.frontmatter.tags.map((t) => (
              <span
                key={t}
                className="text-[11px] text-[var(--color-fg-muted)] bg-[var(--color-surface)] rounded px-1.5 h-5 flex items-center border"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        {video.links.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap ml-1">
            {video.links.map((slug) => (
              <Link
                key={slug}
                href={resolveLink(slug)}
                title={`Linked: ${slug}`}
                className="inline-flex items-center gap-1 text-[11px] text-[var(--color-fg-muted)] bg-[var(--color-surface)] rounded px-1.5 h-5 border hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)] transition-colors"
              >
                <Link2 className="w-3 h-3" />
                {slug}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
