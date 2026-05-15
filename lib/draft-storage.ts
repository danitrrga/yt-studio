'use client';

import { get, set, del } from 'idb-keyval';

// Persist in-flight drafts so a browser crash doesn't lose work.
// Key: draft:<slug>. Value: { body, mtime, savedAt }

export interface StoredDraft {
  body: string;
  baselineMtime: number;
  savedAt: number;
}

const keyFor = (slug: string) => `draft:${slug}`;

export async function loadDraft(slug: string): Promise<StoredDraft | null> {
  if (typeof window === 'undefined') return null;
  try {
    const v = await get<StoredDraft>(keyFor(slug));
    return v ?? null;
  } catch {
    return null;
  }
}

export async function saveDraft(slug: string, draft: StoredDraft): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await set(keyFor(slug), draft);
  } catch {
    // Quota exceeded or private mode — ignore
  }
}

export async function clearDraft(slug: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await del(keyFor(slug));
  } catch {}
}
