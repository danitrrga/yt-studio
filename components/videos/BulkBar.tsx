'use client';

import * as Popover from '@radix-ui/react-popover';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Video as VideoIcon, CheckCircle2, ChevronDown, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { VideoStatus, VideoSummary } from '@/lib/types';
import { STATUS_ORDER, STATUS_LABELS, STATUS_COLOR_VAR } from '@/lib/status';
import {
  updateVideoField,
  deleteVideoRequest,
  restoreVideoRequest,
} from '@/hooks/use-videos';
import { selection, useSelectionSize } from '@/hooks/use-selection';
import { cn } from '@/lib/utils';

export function BulkBar({
  videos,
  onMutate,
}: {
  videos: VideoSummary[];
  onMutate: () => void;
}) {
  const size = useSelectionSize();
  if (size === 0) return null;

  const slugs = selection.list();
  const selectedVideos = videos.filter((v) => slugs.includes(v.slug));

  const bulkSetStatus = async (next: VideoStatus) => {
    const prev = new Map(selectedVideos.map((v) => [v.slug, v.frontmatter.status]));
    const results = await Promise.allSettled(
      slugs.map((slug) => updateVideoField(slug, { status: next }))
    );
    onMutate();
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) {
      toast.error(`${failed} of ${slugs.length} failed`);
    } else {
      toast.success(`${slugs.length} → ${next}`, {
        duration: 6000,
        action: {
          label: 'Undo',
          onClick: async () => {
            await Promise.allSettled(
              Array.from(prev.entries()).map(([slug, st]) =>
                updateVideoField(slug, { status: st })
              )
            );
            onMutate();
          },
        },
      });
    }
  };

  const bulkSetDate = async (
    field: 'target_date' | 'record_date' | 'published_date',
    value: string | null
  ) => {
    const prev = new Map(
      selectedVideos.map((v) => [v.slug, v.frontmatter[field]])
    );
    const results = await Promise.allSettled(
      slugs.map((slug) => updateVideoField(slug, { [field]: value }))
    );
    onMutate();
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) {
      toast.error(`${failed} of ${slugs.length} failed`);
    } else {
      toast.success(`${slugs.length} videos updated`, {
        duration: 6000,
        action: {
          label: 'Undo',
          onClick: async () => {
            await Promise.allSettled(
              Array.from(prev.entries()).map(([slug, val]) =>
                updateVideoField(slug, { [field]: val })
              )
            );
            onMutate();
          },
        },
      });
    }
  };

  const bulkDelete = async () => {
    if (!confirm(`Move ${slugs.length} video${slugs.length === 1 ? '' : 's'} to trash?`)) return;
    const trashed: { slug: string; trashedAt: number }[] = [];
    const results = await Promise.allSettled(
      slugs.map(async (slug) => {
        const res = await deleteVideoRequest(slug);
        trashed.push({ slug: res.slug, trashedAt: res.trashedAt });
      })
    );
    onMutate();
    selection.clear();
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) {
      toast.error(`${failed} of ${slugs.length} failed`);
    } else {
      toast.success(`Trashed ${slugs.length} video${slugs.length === 1 ? '' : 's'}`, {
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: async () => {
            await Promise.allSettled(
              trashed.map((t) => restoreVideoRequest(t.slug, t.trashedAt))
            );
            onMutate();
          },
        },
      });
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-[var(--color-surface-elevated)] border rounded-full pl-4 pr-2 h-11"
      >
        <span className="text-xs font-medium text-[var(--color-fg)]">
          {size} selected
        </span>
        <span className="w-px h-4 bg-[var(--color-border)]" />

        <StatusMenu onPick={bulkSetStatus} />
        <DateMenu label="Plan" icon={Target} onPick={(d) => bulkSetDate('target_date', d)} />
        <DateMenu label="Record" icon={VideoIcon} onPick={(d) => bulkSetDate('record_date', d)} />
        <DateMenu label="Published" icon={CheckCircle2} onPick={(d) => bulkSetDate('published_date', d)} />

        <span className="w-px h-4 bg-[var(--color-border)]" />

        <button
          onClick={bulkDelete}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs text-[hsl(var(--color-overdue))] hover:bg-[hsl(var(--color-overdue)/0.1)]"
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>

        <button
          onClick={() => selection.clear()}
          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)]"
          title="Clear selection (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

function StatusMenu({ onPick }: { onPick: (s: VideoStatus) => void }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-xs text-[var(--color-fg-secondary)] hover:bg-[var(--color-surface-hover)]">
          Status
          <ChevronDown className="w-3 h-3" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="start"
          className="z-[60] rounded-lg border bg-[var(--color-surface-elevated)] py-1 min-w-[160px]"
        >
          {STATUS_ORDER.map((s) => {
            const colorVar = STATUS_COLOR_VAR[s];
            return (
              <Popover.Close
                key={s}
                onClick={() => onPick(s)}
                className="w-full text-left flex items-center gap-2 px-3 h-8 text-sm hover:bg-[var(--color-surface-hover)]"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: `hsl(var(${colorVar}))` }}
                />
                {STATUS_LABELS[s]}
              </Popover.Close>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function DateMenu({
  label,
  icon: Icon,
  onPick,
}: {
  label: string;
  icon: typeof Target;
  onPick: (date: string | null) => void;
}) {
  let draft = '';
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className={cn(
          'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs',
          'text-[var(--color-fg-secondary)] hover:bg-[var(--color-surface-hover)]'
        )}>
          <Icon className="w-3 h-3" />
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="start"
          className="z-[60] rounded-lg border bg-[var(--color-surface-elevated)] p-3 w-[220px] space-y-3"
        >
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
            Set {label.toLowerCase()} for selected
          </div>
          <input
            type="date"
            autoFocus
            onChange={(e) => { draft = e.target.value; }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onPick(draft || null);
                (e.target as HTMLInputElement).closest('[data-radix-popper-content-wrapper]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
              }
            }}
            className="w-full h-9 px-2 rounded-md border bg-[var(--color-surface)] text-sm outline-none"
          />
          <div className="flex items-center justify-between">
            <Popover.Close
              onClick={() => onPick(null)}
              className="text-xs text-[var(--color-fg-muted)] hover:text-[hsl(var(--color-overdue))]"
            >
              Clear
            </Popover.Close>
            <Popover.Close
              onClick={() => onPick(draft || null)}
              className="px-2.5 h-7 rounded text-xs font-medium bg-[var(--color-button-primary)] text-[var(--color-button-primary-fg)] hover:bg-[var(--color-button-primary-hover)]"
            >
              Save
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
