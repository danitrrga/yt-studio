'use client';

import * as Popover from '@radix-ui/react-popover';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ExternalLink, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import type { VideoSummary, VideoStatus, Audience } from '@/lib/types';
import type { FieldId, Density, GroupBy } from '@/lib/filter-types';
import { newId } from '@/lib/filter-types';
import { useActiveView, viewStore } from '@/hooks/use-view-store';
import { selection, useSelectionIds } from '@/hooks/use-selection';
import { groupVideos } from '@/lib/group-apply';
import { StatusSelect } from './StatusSelect';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  updateVideoField,
  deleteVideoRequest,
  restoreVideoRequest,
} from '@/hooks/use-videos';
import { cn } from '@/lib/utils';

type SortKey = FieldId;

const DENSITY: Record<Density, { row: string; pad: string; text: string }> = {
  compact: { row: 'h-8', pad: 'px-3 py-1', text: 'text-[12px]' },
  regular: { row: 'h-10', pad: 'px-4 py-1.5', text: 'text-sm' },
  comfortable: { row: 'h-12', pad: 'px-4 py-2.5', text: 'text-sm' },
};

function fmt(d: string | null) {
  if (!d) return '—';
  try {
    return format(parseISO(d), 'MMM d');
  } catch {
    return d;
  }
}

export function TableView({
  videos,
  onRowClick,
  onMutate,
}: {
  videos: VideoSummary[];
  onRowClick: (slug: string) => void;
  onMutate: () => void;
}) {
  const view = useActiveView();
  const density: Density = view.density ?? 'regular';
  const groupBy: GroupBy = view.groupBy ?? 'none';
  const tokens = DENSITY[density];
  const [confirmSlug, setConfirmSlug] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const primarySort = view.sort[0];
  const selectedIds = useSelectionIds();
  const orderedSlugs = useMemo(() => videos.map((v) => v.slug), [videos]);
  const groups = useMemo(() => groupVideos(videos, groupBy), [videos, groupBy]);

  const toggleCollapsed = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const confirmTarget = confirmSlug ? videos.find((v) => v.slug === confirmSlug) : null;

  // Selection keyboard: Esc clears
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selection.size() > 0) {
        // Don't steal from inputs
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) return;
        e.preventDefault();
        selection.clear();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) return;
        e.preventDefault();
        selection.setAll(orderedSlugs);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [orderedSlugs]);

  const performDelete = async (slug: string, title: string) => {
    try {
      const res = await deleteVideoRequest(slug);
      onMutate();
      toast.success(`Deleted "${title}"`, {
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await restoreVideoRequest(res.slug, res.trashedAt);
              onMutate();
              toast.success(`Restored "${title}"`);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Restore failed');
            }
          },
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const toggleSort = (k: SortKey, append: boolean) => {
    const current = view.sort;
    const existing = current.find((s) => s.field === k);
    if (existing) {
      const flipped = current.map((s) =>
        s.field === k
          ? { ...s, direction: s.direction === 'asc' ? ('desc' as const) : ('asc' as const) }
          : s
      );
      viewStore.setSort(flipped);
      return;
    }
    const rule = { id: newId(), field: k, direction: 'asc' as const };
    viewStore.setSort(append ? [...current, rule] : [rule]);
  };

  const handleStatus = async (slug: string, next: VideoStatus) => {
    await updateVideoField(slug, { status: next });
    onMutate();
  };

  const handleRowClick = (e: React.MouseEvent, slug: string) => {
    if (e.shiftKey) {
      e.preventDefault();
      selection.toggleRange(slug, orderedSlugs);
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      selection.toggle(slug);
      return;
    }
    onRowClick(slug);
  };

  const Header = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => {
    const rule = view.sort.find((s) => s.field === k);
    const isPrimary = primarySort?.field === k;
    return (
      <th
        onClick={(e) => toggleSort(k, e.shiftKey || e.metaKey || e.ctrlKey)}
        className={cn(
          'text-left font-mono text-xs font-medium uppercase tracking-wider text-[var(--fg-dim)]',
          tokens.pad,
          'cursor-pointer hover:text-[var(--fg-muted)] select-none',
          className
        )}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          {rule &&
            (rule.direction === 'asc' ? (
              <ArrowUp className={cn('w-3 h-3', isPrimary ? 'text-[var(--fg)]' : 'opacity-60')} />
            ) : (
              <ArrowDown className={cn('w-3 h-3', isPrimary ? 'text-[var(--fg)]' : 'opacity-60')} />
            ))}
        </span>
      </th>
    );
  };

  const showCheckboxes = selectedIds.size > 0;

  return (
    <div className="rounded-md border bg-[var(--bg-raised)] overflow-hidden">
      <table className="w-full">
        <thead className="bg-[var(--bg-raised)] border-b">
          <tr>
            <th className={cn('w-8', tokens.pad)}>
              <Checkbox
                size="sm"
                checked={
                  selectedIds.size === 0
                    ? false
                    : selectedIds.size === orderedSlugs.length
                    ? true
                    : 'indeterminate'
                }
                onChange={() => {
                  if (selectedIds.size === orderedSlugs.length) selection.clear();
                  else selection.setAll(orderedSlugs);
                }}
                title="Toggle all"
              />
            </th>
            <Header k="title">Title</Header>
            <Header k="status">Status</Header>
            <Header k="target_date">Plan</Header>
            <Header k="record_date">Record</Header>
            <Header k="category">Category</Header>
            <Header k="audience">Audience</Header>
            <th className={cn('w-8', tokens.pad)}></th>
          </tr>
        </thead>
        {groups.map((g) => {
          const isCollapsed = collapsed.has(g.key);
          return (
        <tbody key={g.key}>
          {groupBy !== 'none' && (
            <tr className="bg-[var(--bg-raised)]/60 border-b border-[var(--line-faint)] sticky top-0 z-[5]">
              <td colSpan={8} className="px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(g.key)}
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                >
                  {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {g.label || 'Group'}
                  <span className="text-[var(--fg-dim)] ml-1 normal-case font-normal tracking-normal">
                    {g.items.length}
                  </span>
                </button>
              </td>
            </tr>
          )}
          {!isCollapsed && g.items.map((v) => {
            const isSelected = selectedIds.has(v.slug);
            return (
              <tr
                key={v.slug}
                className={cn(
                  'border-b border-[var(--line-faint)] transition-colors group',
                  isSelected
                    ? 'bg-[var(--bg-hover)] hover:bg-[var(--bg-selected)]'
                    : 'hover:bg-[var(--bg-hover)]'
                )}
              >
                <td
                  className={cn(tokens.pad)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (e.shiftKey) selection.toggleRange(v.slug, orderedSlugs);
                    else selection.toggle(v.slug);
                  }}
                >
                  <div
                    className={cn(
                      'transition-opacity',
                      showCheckboxes ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    )}
                  >
                    <Checkbox size="sm" checked={isSelected} title="Select row" />
                  </div>
                </td>
                <td
                  onClick={(e) => handleRowClick(e, v.slug)}
                  className={cn(tokens.pad, 'cursor-pointer')}
                >
                  <div className={cn('font-medium text-[var(--fg)] line-clamp-1', tokens.text)}>
                    {v.frontmatter.title || v.slug}
                  </div>
                  {v.frontmatter.tags && v.frontmatter.tags.length > 0 && density !== 'compact' && (
                    <div className="text-xs text-[var(--fg-dim)] line-clamp-1 mt-0.5">
                      {v.frontmatter.tags
                        .filter((t) => t !== 'youtube' && t !== 'video')
                        .slice(0, 3)
                        .join(' · ')}
                    </div>
                  )}
                </td>
                <td className={tokens.pad} onClick={(e) => e.stopPropagation()}>
                  <StatusSelect
                    value={v.frontmatter.status}
                    onChange={(next) => handleStatus(v.slug, next)}
                  />
                </td>
                <td className={tokens.pad} onClick={(e) => e.stopPropagation()}>
                  <DateCell
                    value={v.frontmatter.target_date}
                    onSave={async (d) => {
                      await updateVideoField(v.slug, { target_date: d });
                      onMutate();
                    }}
                  />
                </td>
                <td className={tokens.pad} onClick={(e) => e.stopPropagation()}>
                  <DateCell
                    value={v.frontmatter.record_date}
                    onSave={async (d) => {
                      await updateVideoField(v.slug, { record_date: d });
                      onMutate();
                    }}
                  />
                </td>
                <td className={tokens.pad} onClick={(e) => e.stopPropagation()}>
                  <TextCell
                    value={v.frontmatter.category ?? ''}
                    placeholder="—"
                    onSave={async (next) => {
                      await updateVideoField(v.slug, { category: next });
                      onMutate();
                    }}
                  />
                </td>
                <td className={tokens.pad} onClick={(e) => e.stopPropagation()}>
                  <AudienceCell
                    value={v.frontmatter.audience}
                    onSave={async (next) => {
                      await updateVideoField(v.slug, { audience: next });
                      onMutate();
                    }}
                  />
                </td>
                <td className={cn('w-8', tokens.pad)}>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={v.obsidianUri}
                      title="Open in Obsidian"
                      className="p-1 rounded text-[var(--fg-dim)] hover:text-[var(--fg)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      title="Delete video"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmSlug(v.slug);
                      }}
                      className="p-1 rounded text-[var(--fg-dim)] hover:text-[var(--fg)]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
          );
        })}
      </table>
      {videos.length === 0 && (
        <div className="px-4 py-12 text-center text-sm text-[var(--fg-dim)]">
          No videos match these filters.
        </div>
      )}
      <ConfirmDialog
        open={!!confirmSlug}
        onOpenChange={(v) => !v && setConfirmSlug(null)}
        title="Delete this video?"
        description={
          confirmTarget
            ? `"${confirmTarget.frontmatter.title || confirmTarget.slug}" will be moved to trash. Undo available from the toast.`
            : undefined
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (!confirmTarget) return;
          performDelete(confirmTarget.slug, confirmTarget.frontmatter.title || confirmTarget.slug);
        }}
      />
    </div>
  );
}

function DateCell({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (next: string | null) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => setDraft(value ?? ''), [value]);

  const commit = async (v: string | null) => {
    setBusy(true);
    try {
      await onSave(v);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          onClick={(e) => {
            if ((e.metaKey || e.ctrlKey) && value) {
              e.preventDefault();
              commit(null);
              return;
            }
            setOpen((o) => !o);
          }}
          className={cn(
            'text-left rounded px-1 -mx-1 py-0.5 hover:bg-[var(--bg-hover)]',
            value ? 'text-[var(--fg-muted)]' : 'text-[var(--fg-dim)]'
          )}
        >
          {fmt(value)}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          className="z-[60] w-[220px] rounded-md border bg-[var(--bg-raised)] p-3 space-y-3"
        >
          <input
            type="date"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit(draft || null);
              if (e.key === 'Escape') setOpen(false);
            }}
            className="w-full h-9 px-2 rounded-md border bg-[var(--bg-raised)] text-sm outline-none"
          />
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={busy || !value}
              onClick={() => commit(null)}
              className="text-xs text-[var(--fg-dim)] hover:text-[var(--fg)] disabled:opacity-40"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => commit(draft || null)}
              className="px-2.5 h-7 rounded text-xs font-medium bg-[var(--fg)] text-[var(--fg-inverse)] hover:bg-[var(--fg)]"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function TextCell({
  value,
  placeholder,
  onSave,
}: {
  value: string;
  placeholder?: string;
  onSave: (next: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  useEffect(() => setDraft(value), [value]);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={cn(
          'text-left w-full rounded px-1 -mx-1 py-0.5 hover:bg-[var(--bg-hover)] truncate',
          value ? 'text-[var(--fg-muted)]' : 'text-[var(--fg-dim)]'
        )}
      >
        {value || placeholder || '—'}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onSave(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
      className="w-full h-7 px-1 -mx-1 bg-[var(--bg-raised)] outline-none text-sm rounded"
    />
  );
}

function AudienceCell({
  value,
  onSave,
}: {
  value: Audience | null | undefined;
  onSave: (next: Audience | null) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="rounded px-1 -mx-1 py-0.5 hover:bg-[var(--bg-hover)]">
          {value ? (
            <Badge>{value}</Badge>
          ) : (
            <span className="text-[var(--fg-dim)] text-sm">—</span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          className="z-[60] rounded-md border bg-[var(--bg-raised)] py-1 min-w-[160px]"
        >
          {(['TOFU', 'MOFU', 'BOFU'] as Audience[]).map((a) => (
            <Popover.Close
              key={a}
              onClick={() => onSave(a)}
              className="w-full text-left px-3 h-8 text-sm hover:bg-[var(--bg-hover)]"
            >
              {a}
            </Popover.Close>
          ))}
          {value && (
            <Popover.Close
              onClick={() => onSave(null)}
              className="w-full text-left px-3 h-8 text-sm text-[var(--fg-dim)] hover:text-[var(--fg)] hover:bg-[var(--bg-hover)]"
            >
              Clear
            </Popover.Close>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
