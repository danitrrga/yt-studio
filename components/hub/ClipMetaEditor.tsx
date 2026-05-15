'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { patchClipRequest } from '@/hooks/use-hub';
import type { HubClip } from '@/lib/types';

export function ClipTitleField({
  slug,
  initial,
  onPatched,
}: {
  slug: string;
  initial: string;
  onPatched: (clip: HubClip) => void;
}) {
  const [value, setValue] = useState(initial);
  const baseline = useRef(initial);

  useEffect(() => {
    setValue(initial);
    baseline.current = initial;
  }, [initial, slug]);

  const commit = async () => {
    const next = value.trim();
    if (next === baseline.current) return;
    if (!next) {
      setValue(baseline.current);
      return;
    }
    try {
      const clip = await patchClipRequest(slug, { title: next });
      baseline.current = next;
      onPatched(clip);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
      setValue(baseline.current);
    }
  };

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === 'Escape') {
          setValue(baseline.current);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="Untitled clip"
      className="w-full bg-transparent outline-none text-[22px] font-semibold tracking-[-0.012em] leading-[1.25] focus:bg-[var(--color-surface-hover)] rounded px-1 -mx-1 transition-colors"
    />
  );
}

export function ClipTagsField({
  slug,
  initial,
  onPatched,
}: {
  slug: string;
  initial: string[];
  onPatched: (clip: HubClip) => void;
}) {
  const [tags, setTags] = useState<string[]>(initial);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setTags(initial);
  }, [initial.join('|'), slug]);

  const persist = async (next: string[]) => {
    try {
      const clip = await patchClipRequest(slug, { tags: next });
      onPatched(clip);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
      setTags(initial);
    }
  };

  const addTag = () => {
    const t = draft.trim().toLowerCase().replace(/^#/, '');
    if (!t) return;
    if (tags.includes(t)) {
      setDraft('');
      return;
    }
    const next = [...tags, t];
    setTags(next);
    setDraft('');
    persist(next);
  };

  const removeTag = (t: string) => {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    persist(next);
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {tags.map((t) => (
        <span
          key={t}
          className="group inline-flex items-center gap-1 text-[11px] pl-1.5 pr-1 py-0.5 rounded bg-[var(--color-surface-elevated)] text-[var(--color-fg-secondary)]"
        >
          #{t}
          <button
            onClick={() => removeTag(t)}
            className="opacity-50 group-hover:opacity-100 hover:text-[hsl(var(--color-overdue))]"
            aria-label={`Remove tag ${t}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag();
          }
          if (e.key === 'Backspace' && !draft && tags.length > 0) {
            removeTag(tags[tags.length - 1]);
          }
        }}
        onBlur={addTag}
        placeholder="+ tag"
        className="text-[11px] bg-transparent outline-none w-16 px-1 placeholder:text-[var(--color-fg-muted)]"
      />
    </div>
  );
}

export function ClipCategoryField({
  slug,
  initial,
  onPatched,
}: {
  slug: string;
  initial: string;
  onPatched: (clip: HubClip) => void;
}) {
  const [value, setValue] = useState(initial);
  const baseline = useRef(initial);

  useEffect(() => {
    setValue(initial);
    baseline.current = initial;
  }, [initial, slug]);

  const commit = async () => {
    const next = value.trim();
    if (next === baseline.current) return;
    try {
      const clip = await patchClipRequest(slug, { category: next });
      baseline.current = next;
      onPatched(clip);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
      setValue(baseline.current);
    }
  };

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setValue(baseline.current);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="+ category"
      className="text-xs bg-transparent outline-none px-1 -mx-1 rounded focus:bg-[var(--color-surface-hover)] w-32"
    />
  );
}

export function ClipCycleField({
  slug,
  initial,
  onPatched,
}: {
  slug: string;
  initial: number | null;
  onPatched: (clip: HubClip) => void;
}) {
  const [value, setValue] = useState(initial?.toString() ?? '');
  const baseline = useRef(initial?.toString() ?? '');

  useEffect(() => {
    setValue(initial?.toString() ?? '');
    baseline.current = initial?.toString() ?? '';
  }, [initial, slug]);

  const commit = async () => {
    const v = value.trim();
    if (v === baseline.current) return;
    const next = v ? Number(v) : null;
    if (next !== null && !Number.isFinite(next)) {
      setValue(baseline.current);
      return;
    }
    try {
      const clip = await patchClipRequest(slug, { cycle: next });
      baseline.current = v;
      onPatched(clip);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
      setValue(baseline.current);
    }
  };

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setValue(baseline.current);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="—"
      type="number"
      className="text-xs bg-transparent outline-none px-1 -mx-1 rounded focus:bg-[var(--color-surface-hover)] w-12 tabular-nums"
    />
  );
}
