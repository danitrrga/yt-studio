'use client';

import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { Video, VideoStatus } from '@/lib/types';
import { STATUS_COLOR_VAR } from '@/lib/status';
import { updateVideoField } from '@/hooks/use-videos';
import { registerShortcut } from '@/lib/shortcuts';
import { cn } from '@/lib/utils';

interface AdvanceStep {
  label: string;
  nextStatus: VideoStatus | null;
  sideEffect?: (video: Video) => Record<string, unknown>;
  terminal?: boolean;
  postAction?: (video: Video) => void;
}

const ADVANCE_MAP: Record<VideoStatus, AdvanceStep> = {
  idea: {
    label: 'Start researching',
    nextStatus: 'research',
  },
  research: {
    label: 'Start scripting',
    nextStatus: 'scripting',
  },
  scripting: {
    label: 'Ready to record',
    nextStatus: 'filming',
    sideEffect: (v) =>
      v.frontmatter.record_date == null
        ? { record_date: new Date().toISOString().split('T')[0] }
        : {},
  },
  filming: {
    label: 'Ready to edit',
    nextStatus: 'editing',
  },
  editing: {
    label: 'Ready to publish',
    nextStatus: 'published',
    sideEffect: (v) =>
      v.frontmatter.published_date == null
        ? { published_date: new Date().toISOString().split('T')[0] }
        : {},
  },
  published: {
    label: 'Write post-mortem',
    nextStatus: null,
    terminal: true,
    postAction: () => {
      const el = document.getElementById('post-mortem-card');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Focus post-mortem textarea if present
      setTimeout(() => {
        const ta = el?.querySelector('textarea') as HTMLTextAreaElement | null;
        ta?.focus();
      }, 300);
    },
  },
};

export function StatusAdvanceBanner({
  video,
  onMutate,
  checklistIncomplete,
}: {
  video: Video;
  onMutate: () => void;
  checklistIncomplete?: boolean;
}) {
  const step = ADVANCE_MAP[video.frontmatter.status] ?? ADVANCE_MAP['idea'];
  const colorVar = STATUS_COLOR_VAR[video.frontmatter.status] ?? STATUS_COLOR_VAR['idea'];
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const advance = useMemo(
    () => async () => {
      if (step.terminal) {
        step.postAction?.(video);
        return;
      }
      if (!step.nextStatus) return;

      if (step.nextStatus === 'published' && checklistIncomplete) {
        toast.warning('Publish checklist has open items — review before shipping.');
      }

      const effects = step.sideEffect ? step.sideEffect(video) : {};
      const prevStatus = video.frontmatter.status;
      try {
        await updateVideoField(video.slug, {
          status: step.nextStatus,
          ...effects,
        });
        onMutate();
        toast.success(`Status → ${step.nextStatus}`, {
          duration: 5000,
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                await updateVideoField(video.slug, { status: prevStatus });
                onMutate();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Undo failed');
              }
            },
          },
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Status change failed');
      }
    },
    [step, video, onMutate, checklistIncomplete]
  );

  useEffect(() => {
    return registerShortcut({
      id: 'detail.status.advance',
      keys: ['Shift', 'S'],
      scope: 'detail',
      group: 'Video',
      label: 'Advance status',
      run: () => buttonRef.current?.focus(),
    });
  }, []);

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-lg border bg-[var(--color-surface)] px-4 py-3',
        'border-l-[4px]'
      )}
      style={{ borderLeftColor: `hsl(var(${colorVar}))` }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Sparkles
          className="w-4 h-4 shrink-0"
          style={{ color: `hsl(var(${colorVar}))` }}
        />
        <div className="min-w-0">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-fg-muted)]">
            Next
          </div>
          <div className="text-[13px] font-medium text-[var(--color-fg)] truncate">
            {step.label}
          </div>
        </div>
      </div>
      <button
        ref={buttonRef}
        onClick={advance}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium',
          'bg-[var(--color-button-primary)] text-[var(--color-button-primary-fg)] hover:bg-[var(--color-button-primary-hover)] transition-colors',
          'outline-none'
        )}
      >
        {step.terminal ? 'Go' : 'Advance'}
        <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}
