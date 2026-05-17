'use client';

import Link from 'next/link';
import { Library, ArrowUpRight, Film, FileText, Hash, Mic, Link2 } from 'lucide-react';
import { useHubClips } from '@/hooks/use-hub';
import { thumbnailSrc } from '@/components/hub/hub-utils';
import { cn } from '@/lib/utils';
import type { HubSource } from '@/lib/types';

const SOURCE_ICON: Record<HubSource, typeof Film> = {
  youtube: Film,
  article: FileText,
  tweet: Hash,
  podcast: Mic,
  other: Link2,
};

function hostFrom(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function LinkedClipsCard({ videoSlug }: { videoSlug: string }) {
  const { clips } = useHubClips();
  const linked = (clips ?? []).filter((c) =>
    c.frontmatter.linked_video_slugs.includes(videoSlug)
  );
  if (linked.length === 0) return null;

  return (
    <section className="rounded-md border bg-[var(--bg-raised)]">
      <div className="flex items-center gap-2 px-4 h-11 border-b">
        <Library className="w-4 h-4 text-[var(--fg-dim)]" />
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--fg)]">
          Research clips
        </span>
        <span className="ml-auto text-xs tabular-nums text-[var(--fg-dim)]">
          {linked.length}
        </span>
      </div>
      <ul className="divide-y divide-[var(--line-faint)]">
        {linked.map((clip) => {
          const Icon = SOURCE_ICON[clip.frontmatter.source];
          const thumbUrl = thumbnailSrc(clip);
          return (
            <li key={clip.slug}>
              <Link
                href={`/hub/${clip.slug}`}
                className="group flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors"
              >
                {thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbUrl}
                    alt=""
                    className="w-16 aspect-video rounded border bg-[var(--bg-raised)] object-cover shrink-0"
                  />
                ) : (
                  <div className="w-16 aspect-video rounded border bg-[var(--bg-raised)] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[var(--fg-dim)]" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium line-clamp-1 text-[var(--fg)]">
                    {clip.frontmatter.title || clip.frontmatter.url}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--fg-dim)] mt-0.5">
                    <Icon className="w-3 h-3" />
                    <span className="truncate">{hostFrom(clip.frontmatter.url)}</span>
                  </div>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-[var(--fg-dim)] opacity-0 group-hover:opacity-100 shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
