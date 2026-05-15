'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, X, ChevronDown, AlertCircle } from 'lucide-react';
import { registerShortcut } from '@/lib/shortcuts';
import { useUI } from './UIProvider';
import { useSlugSet, useVideos } from '@/hooks/use-videos';
import { cn } from '@/lib/utils';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function QuickAddDialog() {
  const { quickAddOpen, setQuickAddOpen, quickAddPrefill } = useUI();
  const { videos, mutate } = useVideos();
  const slugSet = useSlugSet();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [target, setTarget] = useState('');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const persistExpanded = useRef(false);

  useEffect(() => {
    return registerShortcut({
      id: 'videos.create',
      keys: ['c'],
      scope: 'global',
      group: 'Actions',
      label: 'New video',
      run: () => setQuickAddOpen(true),
    });
  }, [setQuickAddOpen]);

  useEffect(() => {
    if (quickAddOpen) {
      // Apply prefill on open
      if (quickAddPrefill?.targetDate) {
        setTarget(quickAddPrefill.targetDate);
        setShowMore(true);
      }
      return;
    }
    setTitle('');
    setSlug('');
    setSlugTouched(false);
    setTarget('');
    setCategory('');
    setTagsInput('');
    setShowMore(persistExpanded.current);
    setSubmitting(false);
  }, [quickAddOpen, quickAddPrefill]);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  const existingTitle = useMemo(() => {
    if (!slug || !videos) return null;
    const match = videos.find((v) => v.slug === slug);
    return match?.frontmatter.title ?? null;
  }, [slug, videos]);

  const collision = slug.length > 0 && slugSet.has(slug);
  const canSubmit =
    title.trim().length > 0 && slug.length > 0 && !collision && !submitting;

  const submit = async (openScript: boolean) => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter(Boolean);
      const payload: Record<string, unknown> = {
        slug,
        title: title.trim(),
      };
      if (quickAddPrefill?.status) payload.status = quickAddPrefill.status;
      if (target) payload.target_date = target;
      if (category.trim()) payload.category = category.trim();
      if (tags.length) payload.tags = tags;

      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? 'Failed to create');
      }
      const video = await res.json();
      await mutate();
      setQuickAddOpen(false);
      const target_route = openScript
        ? `/videos/${video.slug}/script`
        : `/videos/${video.slug}`;
      router.push(target_route);

      toast.success(`Created "${video.frontmatter.title}"`, {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await fetch(`/api/videos/${video.slug}`, { method: 'DELETE' });
              await mutate();
              toast('Moved to trash', {
                action: {
                  label: 'Open trash',
                  onClick: () => router.push('/videos/trash'),
                },
              });
              router.push('/videos');
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Undo failed');
            }
          },
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create video');
      setSubmitting(false);
    }
  };

  const toggleMore = () => {
    setShowMore((prev) => {
      const next = !prev;
      persistExpanded.current = next;
      return next;
    });
  };

  return (
    <Dialog.Root open={quickAddOpen} onOpenChange={setQuickAddOpen}>
      <AnimatePresence>
        {quickAddOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 z-[55]"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="fixed left-1/2 top-[20vh] -translate-x-1/2 z-[56] w-[min(480px,92vw)] rounded-xl border bg-[var(--color-surface-elevated)]"
              >
                <div className="flex items-center justify-between px-5 h-12 border-b">
                  <Dialog.Title className="text-sm font-semibold inline-flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5" />
                    New video
                  </Dialog.Title>
                  <button
                    onClick={() => setQuickAddOpen(false)}
                    className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-fg-secondary)]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <Field label="Title">
                    <input
                      autoFocus
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canSubmit) {
                          e.preventDefault();
                          submit(e.shiftKey);
                        }
                      }}
                      placeholder="How to break bad cycles"
                      className="w-full h-9 px-3 rounded-md border bg-[var(--color-surface)] text-sm outline-none"
                    />
                  </Field>
                  <Field label="Slug" hint="Filename — a-z, 0-9, hyphens">
                    <input
                      value={slug}
                      onChange={(e) => {
                        setSlug(slugify(e.target.value));
                        setSlugTouched(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canSubmit) {
                          e.preventDefault();
                          submit(e.shiftKey);
                        }
                      }}
                      placeholder="how-to-break-bad-cycles"
                      className={cn(
                        'w-full h-9 px-3 rounded-md border bg-[var(--color-surface)] text-sm outline-none focus:ring-1 font-mono',
                        collision
                          ? 'border-[hsl(var(--color-overdue))] focus:ring-[hsl(var(--color-overdue))]'
                          : ''
                      )}
                    />
                    {collision && existingTitle && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[hsl(var(--color-overdue))]">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>Already exists —</span>
                        <Link
                          href={`/videos/${slug}`}
                          className="underline hover:text-[var(--color-fg)]"
                          onClick={() => setQuickAddOpen(false)}
                        >
                          {existingTitle}
                        </Link>
                      </div>
                    )}
                  </Field>

                  <button
                    type="button"
                    onClick={toggleMore}
                    className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
                  >
                    <ChevronDown
                      className={cn(
                        'w-3 h-3 transition-transform',
                        showMore && 'rotate-180'
                      )}
                    />
                    More
                  </button>

                  <AnimatePresence initial={false}>
                    {showMore && (
                      <motion.div
                        key="more"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden space-y-4"
                      >
                        <Field label="Plan date" hint="Optional">
                          <input
                            type="date"
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            className="w-full h-9 px-3 rounded-md border bg-[var(--color-surface)] text-sm outline-none"
                          />
                        </Field>
                        <Field label="Category" hint="Optional">
                          <input
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="Productivity"
                            className="w-full h-9 px-3 rounded-md border bg-[var(--color-surface)] text-sm outline-none"
                          />
                        </Field>
                        <Field label="Tags" hint="Comma-separated">
                          <input
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                            placeholder="productivity, habits"
                            className="w-full h-9 px-3 rounded-md border bg-[var(--color-surface)] text-sm outline-none"
                          />
                        </Field>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex items-center justify-between px-5 h-12 border-t text-xs text-[var(--color-fg-muted)]">
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded border bg-[var(--color-surface)] text-[10px] font-mono">↵</kbd>
                    create
                    <span className="text-[var(--color-border)]">·</span>
                    <kbd className="px-1.5 py-0.5 rounded border bg-[var(--color-surface)] text-[10px] font-mono">⇧↵</kbd>
                    create &amp; write
                  </span>
                  <button
                    onClick={() => submit(false)}
                    disabled={!canSubmit}
                    className={cn(
                      'px-3 h-7 rounded text-xs font-medium transition-colors',
                      canSubmit
                        ? 'bg-[var(--color-button-primary)] text-[var(--color-button-primary-fg)] hover:bg-[var(--color-button-primary-hover)]'
                        : 'bg-[var(--color-surface)] text-[var(--color-fg-muted)] cursor-not-allowed'
                    )}
                  >
                    {submitting ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-fg-muted)]">
          {label}
        </span>
        {hint && <span className="text-[11px] text-[var(--color-fg-muted)]">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
