'use client';

import useSWR, { useSWRConfig } from 'swr';
import type { HubClipSummary, HubClip } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useHubClips() {
  const { data, error, isLoading, mutate } = useSWR<HubClipSummary[]>(
    '/api/hub',
    fetcher
  );
  return { clips: data, error, isLoading, mutate };
}

export function useHubClip(slug: string | null) {
  const { data, error, isLoading, mutate } = useSWR<HubClip>(
    slug ? `/api/hub/${slug}` : null,
    fetcher
  );
  return { clip: data, error, isLoading, mutate };
}

export function useHubClipCount(): number {
  const { clips } = useHubClips();
  // Sidebar badge counts unread (new) clips only — like Inbox.
  return (clips ?? []).filter((c) => c.frontmatter.status === 'new').length;
}

export async function captureClipRequest(url: string): Promise<HubClipSummary> {
  const res = await fetch('/api/hub', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Capture failed');
  }
  return res.json();
}

export async function deleteClipRequest(slug: string) {
  const res = await fetch(`/api/hub/${slug}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Delete failed');
  }
  return res.json();
}

export async function patchClipRequest(slug: string, patch: Partial<HubClip['frontmatter']>) {
  const res = await fetch(`/api/hub/${slug}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Update failed');
  }
  return res.json() as Promise<HubClip>;
}

export function useHubMutate() {
  const { mutate } = useSWRConfig();
  return () => mutate('/api/hub');
}
