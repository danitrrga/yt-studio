'use client';

import { useEffect, useState } from 'react';
import { Target, Video as VideoIcon, CheckCircle2 } from 'lucide-react';
import type { Video } from '@/lib/types';
import { updateVideoField } from '@/hooks/use-videos';
import { registerShortcut } from '@/lib/shortcuts';
import { StatusPill } from '@/components/ui/StatusPill';
import { DateChip } from './DateChip';

export function VideoHero({
  video,
  onMutate,
}: {
  video: Video;
  onMutate: () => void;
}) {
  const [localTitle, setLocalTitle] = useState(video.frontmatter.title);
  const [targetSignal, setTargetSignal] = useState(0);
  const [recordSignal, setRecordSignal] = useState(0);
  const [publishSignal, setPublishSignal] = useState(0);

  useEffect(() => {
    setLocalTitle(video.frontmatter.title);
  }, [video.frontmatter.title]);

  useEffect(() => {
    const unsubs = [
      registerShortcut({
        id: 'detail.date.target',
        keys: ['t'],
        scope: 'detail',
        group: 'Video',
        label: 'Edit plan date',
        run: () => setTargetSignal((s) => s + 1),
      }),
      registerShortcut({
        id: 'detail.date.record',
        keys: ['r'],
        scope: 'detail',
        group: 'Video',
        label: 'Edit record date',
        run: () => setRecordSignal((s) => s + 1),
      }),
      registerShortcut({
        id: 'detail.date.publish',
        keys: ['p'],
        scope: 'detail',
        group: 'Video',
        label: 'Edit publish date',
        run: () => setPublishSignal((s) => s + 1),
      }),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, []);

  const handleTitleBlur = async () => {
    if (localTitle === video.frontmatter.title) return;
    await updateVideoField(video.slug, { title: localTitle });
    onMutate();
  };

  const today = new Date().toISOString().split('T')[0];
  const targetOverdue =
    !!video.frontmatter.target_date &&
    video.frontmatter.target_date < today &&
    video.frontmatter.status !== 'published';

  const saveDate = (field: 'target_date' | 'record_date' | 'published_date') =>
    async (next: string | null) => {
      await updateVideoField(video.slug, { [field]: next });
      onMutate();
    };

  return (
    <div className="space-y-4">
      <input
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={handleTitleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        placeholder="Untitled video"
        className="w-full bg-transparent outline-none font-semibold tracking-[-0.012em] text-[28px] leading-[1.2] focus:bg-[var(--color-surface-hover)] rounded px-1 -mx-1 py-1"
      />

      <div className="flex items-center gap-2.5 flex-wrap text-[13px]">
        <StatusPill status={video.frontmatter.status} />
        {video.frontmatter.cycle != null && (
          <span className="text-[12px] text-[var(--color-fg-muted)]">
            Cycle {video.frontmatter.cycle}
          </span>
        )}
        {video.frontmatter.category && (
          <span className="text-[12px] text-[var(--color-fg-muted)]">
            · {video.frontmatter.category}
          </span>
        )}
        {video.frontmatter.audience && (
          <span className="text-[12px] text-[var(--color-fg-muted)]">
            · {video.frontmatter.audience}
          </span>
        )}
      </div>

      {video.frontmatter.tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {video.frontmatter.tags.map((t) => (
            <span
              key={t}
              className="text-[11px] text-[var(--color-fg-muted)] bg-[var(--color-surface)] rounded px-1.5 py-0.5 border"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <DateChip
          label="Plan"
          icon={Target}
          date={video.frontmatter.target_date}
          onChange={saveDate('target_date')}
          overdue={targetOverdue}
          openSignal={targetSignal}
        />
        <DateChip
          label="Record"
          icon={VideoIcon}
          date={video.frontmatter.record_date}
          onChange={saveDate('record_date')}
          openSignal={recordSignal}
        />
        <DateChip
          label="Published"
          icon={CheckCircle2}
          date={video.frontmatter.published_date}
          onChange={saveDate('published_date')}
          openSignal={publishSignal}
        />
      </div>
    </div>
  );
}
