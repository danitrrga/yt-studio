'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';
import { Image as ImageIcon, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

// Probe whether a thumbnail exists. Use a HEAD-style fetch via GET with cache-bust.
async function probeFetcher(url: string): Promise<{ exists: boolean; bust: number }> {
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  return { exists: res.ok, bust: Date.now() };
}

export function ThumbnailUploader({ slug }: { slug: string }) {
  const probeUrl = `/api/videos/${slug}/thumbnail`;
  const { data, mutate } = useSWR(probeUrl, probeFetcher, {
    revalidateOnFocus: false,
  });
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [bust, setBust] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (data?.bust) setBust(data.bust);
  }, [data?.bust]);

  const upload = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error(`Max ${MAX_BYTES / 1024 / 1024}MB`);
      return;
    }
    if (!ACCEPT.split(',').includes(file.type)) {
      toast.error('Use jpg, png, or webp');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(probeUrl, { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? 'Upload failed');
      }
      await mutate();
      setBust(Date.now());
      toast.success('Thumbnail uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    try {
      const res = await fetch(probeUrl, { method: 'DELETE' });
      if (!res.ok) throw new Error('Remove failed');
      await mutate();
      toast.success('Thumbnail removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) upload(f);
  };

  const exists = data?.exists ?? false;

  return (
    <div className="rounded-md border bg-[var(--bg-raised)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 h-10 border-b font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--fg-dim)]">
        <ImageIcon className="w-3.5 h-3.5" />
        <span>Thumbnail</span>
        {uploading && <span className="ml-auto text-[10px]">Uploading…</span>}
      </div>
      <div className="p-4">
        {exists ? (
          <div className="relative group">
            <div className="aspect-video w-full rounded-md overflow-hidden bg-[var(--bg-raised)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${probeUrl}?b=${bust}`}
                alt="Video thumbnail"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 bg-black/50 rounded-md">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 h-8 rounded-md text-xs font-medium bg-[var(--bg-raised)] text-[var(--fg)] hover:bg-[var(--bg-hover)]"
              >
                Replace
              </button>
              <button
                onClick={remove}
                className="px-3 h-8 rounded-md text-xs font-medium bg-[var(--red)] text-[var(--fg-inverse)] hover:opacity-90"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              'w-full aspect-video rounded-md border-2 border-dashed transition-colors',
              'flex flex-col items-center justify-center gap-2 cursor-pointer',
              dragOver
                ? 'border-[var(--line-strong)] bg-[var(--bg-hover)]'
                : 'border-[var(--line)] hover:border-[var(--fg-dim)] hover:bg-[var(--bg-hover)]'
            )}
          >
            <Upload className="w-5 h-5 text-[var(--fg-dim)]" strokeWidth={1.5} />
            <div className="text-sm text-[var(--fg-dim)]">
              Click or drop image to upload
            </div>
            <div className="text-[11px] text-[var(--fg-dim)]">
              jpg · png · webp · max 5MB
            </div>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

/** Compact `<img>` for use on cards. Renders an icon placeholder if no thumbnail exists. */
export function ThumbnailPreview({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const probeUrl = `/api/videos/${slug}/thumbnail`;
  const { data } = useSWR(probeUrl, probeFetcher, { revalidateOnFocus: false });
  if (!data?.exists) {
    return (
      <div className={cn('w-full h-full flex items-center justify-center text-[var(--fg-dim)]', className)}>
        <ImageIcon className="w-4 h-4 opacity-40" strokeWidth={1.25} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${probeUrl}?b=${data.bust}`}
      alt=""
      className={cn('w-full h-full object-cover', className)}
    />
  );
}
