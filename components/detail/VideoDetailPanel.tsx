'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X, ExternalLink, Maximize2, Minimize2, ArrowUpRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useVideo, updateVideoField } from '@/hooks/use-videos';
import { Tooltip } from '@/components/ui/Tooltip';
import { StatusSelect } from '@/components/videos/StatusSelect';
import { Badge } from '@/components/ui/Badge';
import { BodyEditor } from './BodyEditor';
import { cn } from '@/lib/utils';

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-fg-muted)]">
        {label}
      </span>
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-1 w-full h-9 px-2.5 rounded-md border bg-[var(--color-surface)] text-sm outline-none"
      />
    </label>
  );
}

export function VideoDetailPanel({
  slug,
  onClose,
  onMutate,
}: {
  slug: string | null;
  onClose: () => void;
  onMutate: () => void;
}) {
  const router = useRouter();
  const { video, mutate } = useVideo(slug);
  const [localTitle, setLocalTitle] = useState('');
  const [expanded, setExpanded] = useState(false);

  const openAsPage = () => {
    if (!video) return;
    onClose();
    router.push(`/videos/${video.slug}`);
  };

  useEffect(() => {
    if (video) setLocalTitle(video.frontmatter.title);
  }, [video]);

  const handleSaveTitle = async () => {
    if (!video || localTitle === video.frontmatter.title) return;
    await updateVideoField(video.slug, { title: localTitle });
    mutate();
    onMutate();
  };

  const handleField = async (field: string, value: unknown) => {
    if (!video) return;
    await updateVideoField(video.slug, { [field]: value });
    mutate();
    onMutate();
  };

  const handleBodySaved = () => {
    mutate();
    onMutate();
  };

  return (
    <Dialog.Root open={!!slug} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {slug && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                className={cn(
                  'fixed right-0 top-0 bottom-0 bg-[var(--color-surface)] border-l z-50 flex flex-col transition-[width] duration-[180ms] ease-out',
                  expanded ? 'w-[min(960px,92vw)]' : 'w-[min(520px,92vw)]'
                )}
              >
                <Dialog.Title className="sr-only">Video details</Dialog.Title>
                {!video ? (
                  <div className="p-6 text-sm text-[var(--color-fg-muted)]">Loading...</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-5 h-14 border-b">
                      <StatusSelect
                        value={video.frontmatter.status}
                        onChange={(s) => handleField('status', s)}
                      />
                      <div className="flex items-center gap-1">
                        <Tooltip content="Open as page (E)" side="bottom">
                          <button
                            onClick={openAsPage}
                            className="flex items-center gap-1 px-2 h-7 rounded border bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-xs text-[var(--color-fg-secondary)]"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            Open
                          </button>
                        </Tooltip>
                        <Tooltip content={expanded ? 'Collapse' : 'Expand'} side="bottom">
                          <button
                            onClick={() => setExpanded((v) => !v)}
                            className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-fg-secondary)]"
                          >
                            {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                          </button>
                        </Tooltip>
                        <Tooltip content="Open in Obsidian" side="bottom">
                          <a
                            href={video.obsidianUri}
                            className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-fg-secondary)]"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Tooltip>
                        <Tooltip content="Close (Esc)" side="bottom">
                          <button
                            onClick={onClose}
                            className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-fg-secondary)]"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
                      <input
                        value={localTitle}
                        onChange={(e) => setLocalTitle(e.target.value)}
                        onBlur={handleSaveTitle}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        className="w-full text-2xl font-bold tracking-tight bg-transparent outline-none focus:bg-[var(--color-surface-hover)] rounded px-1 -mx-1 py-0.5"
                      />

                      <div className="flex flex-wrap gap-2">
                        {video.frontmatter.category && (
                          <Badge>{video.frontmatter.category}</Badge>
                        )}
                        {video.frontmatter.audience && (
                          <Badge>{video.frontmatter.audience}</Badge>
                        )}
                        {video.frontmatter.cycle !== null && (
                          <Badge>Cycle {video.frontmatter.cycle}</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <DateField
                          label="Plan"
                          value={video.frontmatter.target_date}
                          onChange={(v) => handleField('target_date', v)}
                        />
                        <DateField
                          label="Record"
                          value={video.frontmatter.record_date}
                          onChange={(v) => handleField('record_date', v)}
                        />
                        <DateField
                          label="Published"
                          value={video.frontmatter.published_date}
                          onChange={(v) => handleField('published_date', v)}
                        />
                      </div>

                      {video.frontmatter.tags && video.frontmatter.tags.length > 0 && (
                        <div>
                          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-fg-muted)] mb-1.5">
                            Tags
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {video.frontmatter.tags.map((t) => (
                              <Badge key={t}>{t}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <BodyEditor
                        slug={video.slug}
                        initialBody={video.body}
                        onSaved={handleBodySaved}
                      />
                    </div>
                  </>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
