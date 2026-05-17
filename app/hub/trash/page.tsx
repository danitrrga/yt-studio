'use client';

import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Trash2, RotateCcw, X, ArrowLeft } from 'lucide-react';
import type { TrashedClip } from '@/lib/hub-vault';
import { useHubMutate } from '@/hooks/use-hub';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function HubTrashPage() {
  const { data, isLoading, mutate } = useSWR<TrashedClip[]>('/api/hub/trash', fetcher);
  const mutateList = useHubMutate();
  const router = useRouter();

  const restore = async (item: TrashedClip) => {
    try {
      const res = await fetch('/api/hub/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: item.slug, trashedAt: item.trashedAt }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? 'Restore failed');
      }
      mutate();
      mutateList();
      toast.success(`Restored "${item.title}"`, {
        action: { label: 'Open', onClick: () => router.push(`/hub/${item.slug}`) },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Restore failed');
    }
  };

  const purge = async (item: TrashedClip) => {
    try {
      await fetch(`/api/hub/trash?file=${encodeURIComponent(item.fileName)}`, {
        method: 'DELETE',
      });
      mutate();
      toast.success(`Permanently deleted "${item.title}"`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Purge failed');
    }
  };

  return (
    <div className="px-8 py-6 space-y-5 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/hub"
          className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--fg-muted)]"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.012em] leading-[1.2] inline-flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-[var(--fg-dim)]" />
            Hub trash
          </h1>
          <p className="text-[13px] text-[var(--fg-dim)] mt-1">
            deleted clips. restore or purge permanently.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-md border bg-[var(--bg-raised)] p-4">
          <Skeleton variant="row" count={3} />
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <EmptyState
          icon={Trash2}
          title="Trash is empty"
          body="Deleted clips appear here and can be restored."
        />
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="rounded-md border bg-[var(--bg-raised)] divide-y divide-[var(--line-faint)]">
          {data.map((item) => (
            <div
              key={item.fileName}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--bg-hover)]"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-[var(--fg)] line-clamp-1">
                  {item.title}
                </div>
                <div className="text-xs text-[var(--fg-dim)] mt-0.5">
                  Deleted {format(new Date(item.trashedAt), 'PPP p')}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => restore(item)}
                  className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded border bg-[var(--bg-raised)] hover:bg-[var(--bg-hover)] text-xs"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restore
                </button>
                <button
                  onClick={() => purge(item)}
                  title="Permanently delete"
                  className="p-1.5 rounded text-[var(--fg-dim)] hover:text-[var(--fg)] hover:bg-[var(--red-wash)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
