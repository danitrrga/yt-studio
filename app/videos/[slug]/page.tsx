'use client';

import { use, useEffect } from 'react';
import { useVideo } from '@/hooks/use-videos';
import { useVideoNavigation } from '@/hooks/use-video-navigation';
import { recordVisit } from '@/hooks/use-mru';
import { FullPageHeader } from '@/components/detail/FullPageHeader';
import { VideoHero } from '@/components/detail/VideoHero';
import { StatusAdvanceBanner } from '@/components/detail/StatusAdvanceBanner';
import { IdeaEditor } from '@/components/detail/IdeaEditor';
import { Dashboard } from '@/components/detail/Dashboard';
import { useVideoMeta } from '@/hooks/use-video-meta';
import { cn } from '@/lib/utils';

export default function VideoDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { video, mutate } = useVideo(slug);
  const { meta, mutate: mutateMeta } = useVideoMeta(slug);
  const { prev, next, index, total } = useVideoNavigation(slug);

  useEffect(() => {
    if (video) {
      document.title = `${video.frontmatter.title || video.slug} · YT Studio`;
      recordVisit(slug, 'video', video.frontmatter.title || video.slug);
    }
    return () => {
      document.title = 'YouTube Studio';
    };
  }, [video, slug]);

  if (!video) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-[var(--fg-dim)]">
        Loading...
      </div>
    );
  }

  return (
    <div className={cn('h-screen flex flex-col bg-[var(--bg)]')}>
      <FullPageHeader
        video={video}
        prevSlug={prev}
        nextSlug={next}
        saveState={'clean'}
        index={index}
        total={total}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto flex flex-col gap-6 px-6 max-w-[900px] py-8">
          <VideoHero video={video} onMutate={mutate} />

          <StatusAdvanceBanner video={video} onMutate={mutate} />

          <IdeaEditor
            slug={video.slug}
            meta={meta}
            onMutate={() => mutateMeta()}
          />

          <Dashboard
            video={video}
            meta={meta}
            liveBody={video.body}
            onMetaMutate={() => mutateMeta()}
          />
        </div>
      </div>

      <footer className="h-10 shrink-0 border-t flex items-center justify-between px-6 text-xs text-[var(--fg-dim)] bg-[var(--bg-raised)]">
        <span>Dashboard</span>
        <div className="flex items-center gap-3">
          <kbd className="px-1.5 py-0.5 rounded border bg-[var(--bg-raised)] text-[10px]">E</kbd>
          <span>Edit idea</span>
          <span className="text-[var(--line)]">·</span>
          <kbd className="px-1.5 py-0.5 rounded border bg-[var(--bg-raised)] text-[10px]">⇧S</kbd>
          <span>Advance</span>
          <span className="text-[var(--line)]">·</span>
          <kbd className="px-1.5 py-0.5 rounded border bg-[var(--bg-raised)] text-[10px]">J</kbd>
          <kbd className="px-1.5 py-0.5 rounded border bg-[var(--bg-raised)] text-[10px]">K</kbd>
          <span>Next / prev</span>
          <span className="text-[var(--line)]">·</span>
          <kbd className="px-1.5 py-0.5 rounded border bg-[var(--bg-raised)] text-[10px]">Esc</kbd>
          <span>Back</span>
        </div>
      </footer>
    </div>
  );
}
