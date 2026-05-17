'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ExternalLink,
  Film,
  FileText,
  Hash,
  Link2,
  Loader2,
  Mic,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useHubClip, deleteClipRequest, patchClipRequest, useHubMutate } from '@/hooks/use-hub';
import { thumbnailSrc } from '@/components/hub/hub-utils';
import { recordVisit } from '@/hooks/use-mru';
import { useVideos } from '@/hooks/use-videos';
import { CodeMirrorEditor } from '@/components/editor/CodeMirrorEditor';
import { EditorErrorBoundary } from '@/components/editor/EditorErrorBoundary';
import { TextareaFallback } from '@/components/editor/TextareaFallback';
import { LinkVideoPopover } from '@/components/hub/LinkVideoPopover';
import {
  ClipTitleField,
  ClipTagsField,
  ClipCategoryField,
  ClipCycleField,
} from '@/components/hub/ClipMetaEditor';
import { STATUS_SOLID_VAR } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { HubSource } from '@/lib/types';

const SOURCE_ICON: Record<HubSource, typeof Film> = {
  youtube: Film,
  article: FileText,
  tweet: Hash,
  podcast: Mic,
  other: Link2,
};

type SaveState = 'clean' | 'dirty' | 'saving' | 'error';

function hostFrom(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function HubClipPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { clip, isLoading, mutate } = useHubClip(slug);
  const { videos } = useVideos();
  const mutateList = useHubMutate();

  const [draft, setDraft] = useState<string>('');
  const [baseline, setBaseline] = useState<string>('');
  const [save, setSave] = useState<SaveState>('clean');
  const [revisionToken, setRevisionToken] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (!clip) return;
    setDraft(clip.body);
    setBaseline(clip.body);
    setRevisionToken((t) => t + 1);
    setSave('clean');
    recordVisit(slug, 'clip', clip.frontmatter.title || slug);
    // Auto-mark-as-read on first open of a `new` clip
    if (clip.frontmatter.status === 'new') {
      patchClipRequest(clip.slug, { status: 'read' })
        .then(() => {
          mutate();
          mutateList();
        })
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip?.slug]);

  const persistNotes = useCallback(
    async (value: string) => {
      setSave('saving');
      try {
        const res = await fetch(`/api/hub/${slug}/notes`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: value }),
        });
        if (!res.ok) throw new Error('Save failed');
        setBaseline(value);
        setSave((s) => (s === 'saving' ? 'clean' : s));
        mutate();
      } catch (e) {
        setSave('error');
        toast.error(e instanceof Error ? e.message : 'Save failed');
      }
    },
    [slug, mutate]
  );

  const onChange = useCallback(
    (value: string) => {
      setDraft(value);
      if (value === baseline) {
        setSave('clean');
        if (timer.current) clearTimeout(timer.current);
        return;
      }
      setSave('dirty');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => persistNotes(value), 800);
    },
    [baseline, persistNotes]
  );

  // Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        if (draft !== baseline) persistNotes(draft);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [draft, baseline, persistNotes]);

  const videoMap = useMemo(
    () => new Map((videos ?? []).map((v) => [v.slug, v])),
    [videos]
  );
  const linkedVideos = useMemo(() => {
    if (!clip) return [];
    return clip.frontmatter.linked_video_slugs
      .map((s) => videoMap.get(s))
      .filter((v): v is NonNullable<typeof v> => v != null);
  }, [clip, videoMap]);

  const onLink = async (videoSlug: string) => {
    try {
      const res = await fetch(`/api/hub/${slug}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoSlug, action: 'link' }),
      });
      if (!res.ok) throw new Error('Link failed');
      mutate();
      mutateList();
      toast.success('Linked');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Link failed');
    }
  };

  const onUnlink = async (videoSlug: string) => {
    try {
      const res = await fetch(`/api/hub/${slug}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoSlug, action: 'unlink' }),
      });
      if (!res.ok) throw new Error('Unlink failed');
      mutate();
      mutateList();
      toast.success('Unlinked');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unlink failed');
    }
  };

  const onConvert = async () => {
    if (converting) return;
    setConverting(true);
    try {
      const res = await fetch(`/api/hub/${slug}/convert`, { method: 'POST' });
      if (!res.ok) throw new Error('Convert failed');
      const { videoSlug } = (await res.json()) as { videoSlug: string };
      mutate();
      mutateList();
      toast.success('Converted to video', {
        action: {
          label: 'Open',
          onClick: () => router.push(`/videos/${videoSlug}/script`),
        },
      });
      router.push(`/videos/${videoSlug}/script`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Convert failed');
    } finally {
      setConverting(false);
    }
  };

  const onDelete = async () => {
    try {
      await deleteClipRequest(slug);
      mutateList();
      toast.success('Clip moved to trash');
      router.push('/hub');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  if (isLoading) {
    return (
      <div className="px-8 py-6 text-sm text-[var(--fg-dim)]">Loading…</div>
    );
  }

  if (!clip) {
    return (
      <div className="px-8 py-12 max-w-[760px] mx-auto text-center">
        <p className="text-sm text-[var(--fg-dim)]">Clip not found.</p>
        <Link
          href="/hub"
          className="inline-flex items-center gap-1 text-sm mt-3 text-[var(--fg)] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Hub
        </Link>
      </div>
    );
  }

  const Icon = SOURCE_ICON[clip.frontmatter.source];
  const thumbUrl = thumbnailSrc(clip);
  const status = clip.frontmatter.status;
  const isArchived = status === 'archived';

  const setStatus = async (next: 'new' | 'read' | 'archived') => {
    try {
      await patchClipRequest(slug, { status: next });
      mutate();
      mutateList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="sticky top-0 z-20 h-12 px-5 flex items-center justify-between gap-3 border-b bg-[var(--bg)]">
        <Link
          href="/hub"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          <ArrowLeft className="w-4 h-4" />
          Hub
        </Link>
        <div className="flex items-center gap-3">
          <SaveBadge state={save} />
          <button
            onClick={() => setStatus(isArchived ? 'read' : 'archived')}
            className="text-[var(--fg-dim)] hover:text-[var(--fg)]"
            title={isArchived ? 'Unarchive' : 'Archive'}
          >
            {isArchived ? (
              <ArchiveRestore className="w-4 h-4" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
          </button>
          <a
            href={clip.frontmatter.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--fg-dim)] hover:text-[var(--fg)]"
            title="Open URL"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={onDelete}
            className="text-[var(--fg-dim)] hover:text-[var(--fg)]"
            title="Delete clip"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 px-8 py-8">
        <div className="max-w-[760px] mx-auto space-y-6">
          {/* Hero */}
          <section className="flex gap-5 items-start">
            {thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbUrl}
                alt=""
                className="w-44 aspect-video rounded-md border bg-[var(--bg-raised)] object-cover shrink-0"
              />
            ) : (
              <div className="w-44 aspect-video rounded-md border bg-[var(--bg-raised)] flex items-center justify-center shrink-0">
                <Icon className="w-10 h-10 text-[var(--fg-dim)]" />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-2">
              <ClipTitleField
                slug={slug}
                initial={clip.frontmatter.title || ''}
                onPatched={() => mutate()}
              />
              <div className="flex items-center gap-2 flex-wrap text-xs text-[var(--fg-dim)]">
                <Icon className="w-3.5 h-3.5" />
                <span className="capitalize">{clip.frontmatter.source}</span>
                <span>·</span>
                <a
                  href={clip.frontmatter.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--fg)] truncate"
                >
                  {hostFrom(clip.frontmatter.url)}
                </a>
                <span>·</span>
                <span>captured {fmtDate(clip.frontmatter.created_at)}</span>
              </div>
              {clip.frontmatter.description && (
                <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
                  {clip.frontmatter.description}
                </p>
              )}
              <div className="flex items-center gap-3 flex-wrap text-xs text-[var(--fg-dim)]">
                <span className="inline-flex items-center gap-1">
                  Category:
                  <ClipCategoryField
                    slug={slug}
                    initial={clip.frontmatter.category}
                    onPatched={() => mutate()}
                  />
                </span>
                <span className="inline-flex items-center gap-1">
                  Cycle:
                  <ClipCycleField
                    slug={slug}
                    initial={clip.frontmatter.cycle}
                    onPatched={() => mutate()}
                  />
                </span>
              </div>
              <ClipTagsField
                slug={slug}
                initial={clip.frontmatter.tags.filter((t) => t !== 'hub-clip')}
                onPatched={() => mutate()}
              />
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={onConvert}
                  disabled={converting}
                  className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md bg-[var(--fg)] text-[var(--fg-inverse)] text-sm font-medium hover:bg-[var(--fg)] disabled:opacity-60"
                >
                  {converting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Convert to video
                </button>
              </div>
            </div>
          </section>

          {/* Linked videos */}
          <section className="rounded-md border bg-[var(--bg-raised)] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--fg-dim)]">
                Linked videos ({linkedVideos.length})
              </h2>
              <LinkVideoPopover
                alreadyLinked={clip.frontmatter.linked_video_slugs}
                onPick={onLink}
              />
            </div>
            {linkedVideos.length === 0 ? (
              <p className="text-xs text-[var(--fg-dim)]">
                Not linked to any video yet.
              </p>
            ) : (
              <ul className="space-y-1">
                {linkedVideos.map((v) => (
                  <li
                    key={v.slug}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--bg-hover)]"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        background: `var(${STATUS_SOLID_VAR[v.frontmatter.status]})`,
                      }}
                    />
                    <Link
                      href={`/videos/${v.slug}`}
                      className="flex-1 text-sm truncate hover:underline inline-flex items-center gap-1"
                    >
                      {v.frontmatter.title || v.slug}
                      <ArrowUpRight className="w-3 h-3 text-[var(--fg-dim)]" />
                    </Link>
                    <button
                      onClick={() => onUnlink(v.slug)}
                      className="text-[var(--fg-dim)] hover:text-[var(--fg)]"
                      title="Unlink"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Notes */}
          <section className="space-y-2">
            <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--fg-dim)]">
              Notes
            </h2>
            <EditorErrorBoundary
              fallback={(err, retry) => (
                <TextareaFallback
                  draft={draft}
                  onChange={onChange}
                  errorMessage={err.message}
                  onRetryMount={retry}
                  writingMode={false}
                />
              )}
            >
              <CodeMirrorEditor
                key={slug}
                initialMarkdown={draft}
                revisionToken={revisionToken}
                onMarkdownChange={onChange}
                placeholder="Capture takeaways, quotes, why this matters…"
                writingMode={false}
                autoFocus={false}
              />
            </EditorErrorBoundary>
          </section>
        </div>
      </div>
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === 'clean')
    return (
      <span className="text-[11px] text-[var(--status-published-color)] inline-flex items-center gap-1">
        <Check className="w-3 h-3" />
        Saved
      </span>
    );
  if (state === 'dirty')
    return <span className="text-[11px] text-[var(--fg-dim)]">Editing…</span>;
  if (state === 'saving')
    return (
      <span className="text-[11px] text-[var(--fg-dim)] inline-flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        Saving
      </span>
    );
  return <span className="text-[11px] text-[var(--red)]">Save failed</span>;
}
