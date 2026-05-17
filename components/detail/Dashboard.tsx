'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CheckSquare, Image as ImageIcon, NotebookPen, Upload, FileText, ArrowRight, Lock, Type, Lightbulb } from 'lucide-react';
import type { Video, VideoMeta, VideoMetaSection, VideoMetaSectionId } from '@/lib/types';
import { saveVideoMeta } from '@/hooks/use-video-meta';
import { Checkbox } from '@/components/ui/Checkbox';
import { ThumbnailUploader } from './ThumbnailUploader';
import { LinkedClipsCard } from './LinkedClipsCard';
import { useSettings } from '@/hooks/use-settings';
import { cn } from '@/lib/utils';

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const POST_MORTEM_UNLOCK_DAYS = 7;

interface OutlineItem {
  line: number;
  depth: number;
  text: string;
  words: number;
  seconds: number;
}

function parseOutline(body: string, wordsPerSecond: number): OutlineItem[] {
  const lines = body.split(/\r?\n/);
  const raw: { line: number; depth: number; text: string; end: number }[] = [];
  lines.forEach((ln, i) => {
    const m = HEADING_RE.exec(ln);
    if (m) raw.push({ line: i + 1, depth: m[1].length, text: m[2], end: -1 });
  });
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i];
    const next = raw.slice(i + 1).find((n) => n.depth <= cur.depth);
    cur.end = next ? next.line - 1 : lines.length;
  }
  return raw.map((it) => {
    const chunk = lines.slice(it.line, it.end).join(' ');
    const stripped = chunk.replace(/[-*]\s*\[[ xX]\]/g, ' ').trim();
    const words = stripped ? stripped.split(/\s+/).filter(Boolean).length : 0;
    return {
      line: it.line,
      depth: it.depth,
      text: it.text,
      words,
      seconds: Math.round(words / wordsPerSecond),
    };
  });
}

const SECTION_META: Record<
  VideoMetaSectionId,
  { label: string; icon: React.ElementType; placeholder: string }
> = {
  idea: {
    label: 'Idea',
    icon: Lightbulb,
    placeholder: 'One or two sentences that capture the core message.',
  },
  production: {
    label: 'Production',
    icon: CheckSquare,
    placeholder: '- [ ] Script\n- [ ] Record\n- [ ] Edit',
  },
  publish: {
    label: 'Publish',
    icon: Upload,
    placeholder: '- [ ] Thumbnail final\n- [ ] Description + chapters\n- [ ] Scheduled',
  },
  title_ideas: {
    label: 'Title Ideas',
    icon: Type,
    placeholder: '- Title candidate A\n- Title candidate B',
  },
  thumbnail_ideas: {
    label: 'Thumbnail Ideas',
    icon: ImageIcon,
    placeholder: '- Bold text A\n- Bold text B',
  },
  post_mortem: {
    label: 'Post-Mortem',
    icon: NotebookPen,
    placeholder: 'Written after publish.',
  },
};

const FALLBACK_ORDER: { id: VideoMetaSectionId; heading: string }[] = [
  { id: 'idea', heading: 'Idea' },
  { id: 'production', heading: 'Production' },
  { id: 'publish', heading: 'Publish' },
  { id: 'title_ideas', heading: 'Title Ideas' },
  { id: 'thumbnail_ideas', heading: 'Thumbnail Ideas' },
  { id: 'post_mortem', heading: 'Post-Mortem' },
];

function fmtTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function daysUntilUnlock(publishedDate: string | null): number | null {
  if (!publishedDate) return null;
  const pub = new Date(publishedDate + 'T00:00:00');
  if (isNaN(pub.getTime())) return null;
  const unlock = new Date(pub);
  unlock.setDate(unlock.getDate() + POST_MORTEM_UNLOCK_DAYS);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((unlock.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function Dashboard({
  video,
  meta,
  liveBody,
  onMetaMutate,
}: {
  video: Video;
  meta: VideoMeta | null | undefined;
  liveBody: string;
  onMetaMutate: () => void;
}) {
  const sections: VideoMetaSection[] = useMemo(() => {
    if (!meta) {
      return FALLBACK_ORDER.map((s) => ({ id: s.id, heading: s.heading, body: '' }));
    }
    const byId = new Map<VideoMetaSectionId, VideoMetaSection>();
    for (const s of meta.sections) byId.set(s.id, s);
    return FALLBACK_ORDER.map(
      (s) => byId.get(s.id) ?? { id: s.id, heading: s.heading, body: '' }
    );
  }, [meta]);

  const [busy, setBusy] = useState(false);

  const patch = async (id: VideoMetaSectionId, nextBody: string) => {
    const next = sections.map((s) => (s.id === id ? { ...s, body: nextBody } : s));
    setBusy(true);
    try {
      await saveVideoMeta(video.slug, next);
      onMetaMutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const { settings } = useSettings();
  const wordsPerSecond = settings.wordsPerMinute / 60;
  const outline = useMemo(
    () => parseOutline(liveBody, wordsPerSecond),
    [liveBody, wordsPerSecond]
  );
  const topLevelOutline = outline.filter((it) => it.depth <= 2);
  const totalWords = topLevelOutline.reduce((sum, it) => sum + it.words, 0);
  const totalSeconds = Math.round(totalWords / wordsPerSecond);
  const scriptSections = outline.filter((it) => it.depth === 3);

  const daysToUnlock = daysUntilUnlock(video.frontmatter.published_date);
  const postMortemUnlocked = daysToUnlock !== null && daysToUnlock <= 0;
  const byId = new Map(sections.map((s) => [s.id, s]));
  const get = (id: VideoMetaSectionId) =>
    byId.get(id) ?? { id, heading: id, body: '' };

  return (
    <div className="space-y-6">
      <ScriptCard
        slug={video.slug}
        totalWords={totalWords}
        totalSeconds={totalSeconds}
        sections={scriptSections.map((s) => ({ text: s.text, words: s.words, seconds: s.seconds }))}
      />

      <ThumbnailUploader slug={video.slug} />

      <LinkedClipsCard videoSlug={video.slug} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard section={get('production')} onSave={(b) => patch('production', b)} kind="checklist" busy={busy} />
        <SectionCard section={get('publish')} onSave={(b) => patch('publish', b)} kind="checklist" busy={busy} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard section={get('title_ideas')} onSave={(b) => patch('title_ideas', b)} kind="bullet" busy={busy} />
        <SectionCard section={get('thumbnail_ideas')} onSave={(b) => patch('thumbnail_ideas', b)} kind="bullet" busy={busy} />
      </div>

      <div id="post-mortem-card">
        {postMortemUnlocked ? (
          <SectionCard
            section={get('post_mortem')}
            onSave={(b) => patch('post_mortem', b)}
            kind="markdown"
            busy={busy}
          />
        ) : (
          <PostMortemLocked daysUntil={daysToUnlock} />
        )}
      </div>
    </div>
  );
}

function ScriptCard({
  slug,
  totalWords,
  totalSeconds,
  sections,
}: {
  slug: string;
  totalWords: number;
  totalSeconds: number;
  sections: { text: string; words: number; seconds: number }[];
}) {
  return (
    <div className="rounded-md border bg-[var(--bg-raised)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 h-10 border-b font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--fg-dim)]">
        <FileText className="w-3.5 h-3.5" />
        <span>Script</span>
        <span className="ml-auto tabular-nums text-[10px]">
          {totalWords}w · {fmtTime(totalSeconds)}
        </span>
      </div>
      <div className="p-5 space-y-4">
        {sections.length > 0 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--fg-dim)] tabular-nums">
            {sections.map((s, i) => (
              <span key={i}>
                <span className="text-[var(--fg-muted)]">{s.text}</span>
                <span className="mx-1.5 text-[var(--line)]">·</span>
                {s.words}w
                <span className="mx-1 text-[var(--line)]">·</span>
                {fmtTime(s.seconds)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--fg-dim)] italic">
            No script sections yet — open the editor to start.
          </p>
        )}

        <Link
          href={`/videos/${slug}/script`}
          className={cn(
            'inline-flex items-center gap-2 px-3 h-8 rounded-md text-xs font-medium',
            'bg-[var(--fg)] text-[var(--fg-inverse)] hover:bg-[var(--fg)]',
            'transition-colors'
          )}
        >
          Open script editor
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

function PostMortemLocked({ daysUntil }: { daysUntil: number | null }) {
  return (
    <div className="rounded-md border border-dashed bg-[var(--bg-raised)]/40 overflow-hidden opacity-60">
      <div className="flex items-center gap-2 px-4 h-10 border-b border-dashed font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--fg-dim)]">
        <NotebookPen className="w-3.5 h-3.5" />
        <span>Post-Mortem</span>
      </div>
      <div className="p-6 text-center text-sm text-[var(--fg-dim)] inline-flex items-center justify-center gap-2 w-full">
        <Lock className="w-3.5 h-3.5" />
        {daysUntil === null
          ? 'Unlocks after the video is published.'
          : daysUntil > 0
          ? `Unlocks in ${daysUntil} ${daysUntil === 1 ? 'day' : 'days'} after publish.`
          : 'Unlocks now.'}
      </div>
    </div>
  );
}

function SectionCard({
  section,
  onSave,
  kind,
  busy,
}: {
  section: VideoMetaSection;
  onSave: (body: string) => void | Promise<void>;
  kind: 'checklist' | 'markdown' | 'bullet';
  busy: boolean;
}) {
  const meta = SECTION_META[section.id];
  const Icon = meta.icon;

  return (
    <div className="rounded-md border bg-[var(--bg-raised)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 h-10 border-b font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--fg-dim)]">
        <Icon className="w-3.5 h-3.5" />
        <span>{meta.label}</span>
        {busy && <span className="ml-auto text-[10px] text-[var(--fg-dim)]">Saving…</span>}
      </div>
      <div className="p-4">
        {kind === 'checklist' && (
          <ChecklistEditor body={section.body} placeholder={meta.placeholder} onSave={onSave} />
        )}
        {kind === 'bullet' && (
          <BulletListEditor body={section.body} placeholder={meta.placeholder} onSave={onSave} />
        )}
        {kind === 'markdown' && (
          <MarkdownTextArea body={section.body} placeholder={meta.placeholder} onSave={onSave} />
        )}
      </div>
    </div>
  );
}

function MarkdownTextArea({
  body,
  placeholder,
  onSave,
}: {
  body: string;
  placeholder: string;
  onSave: (body: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(body);
  const initial = useRef(body);

  useEffect(() => {
    setValue(body);
    initial.current = body;
  }, [body]);

  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== initial.current) {
          onSave(value);
          initial.current = value;
        }
      }}
      placeholder={placeholder}
      rows={Math.max(3, value.split('\n').length + 1)}
      className="w-full bg-transparent outline-none text-sm font-mono resize-none text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
    />
  );
}

type ChecklistItem = { checked: boolean; text: string };

function parseChecklist(body: string): {
  items: ChecklistItem[];
  preamble: string;
  tail: string[];
} {
  const lines = body.split(/\r?\n/);
  const items: ChecklistItem[] = [];
  const preambleLines: string[] = [];
  const tailLines: string[] = [];
  let phase: 'pre' | 'items' | 'post' = 'pre';
  for (const line of lines) {
    const m = line.match(/^(\s*)-\s+\[([ xX])\]\s+(.*)$/);
    if (m) {
      items.push({ checked: m[2].toLowerCase() === 'x', text: m[3] });
      phase = 'items';
      continue;
    }
    if (phase === 'pre') preambleLines.push(line);
    else tailLines.push(line);
  }
  return {
    items,
    preamble: preambleLines.join('\n').replace(/\s+$/, ''),
    tail: tailLines,
  };
}

function serializeChecklist(items: ChecklistItem[], preamble: string, tail: string[]): string {
  const itemLines = items.map((it) => `- [${it.checked ? 'x' : ' '}] ${it.text}`);
  const parts: string[] = [];
  if (preamble.trim()) parts.push(preamble);
  parts.push(itemLines.join('\n'));
  const tailStr = tail.join('\n').replace(/^\s+/, '').replace(/\s+$/, '');
  if (tailStr) parts.push(tailStr);
  return parts.join('\n\n').replace(/\s+$/, '');
}

function ChecklistEditor({
  body,
  placeholder,
  onSave,
}: {
  body: string;
  placeholder: string;
  onSave: (body: string) => void | Promise<void>;
}) {
  const { items, preamble, tail } = useMemo(() => parseChecklist(body), [body]);
  const [draft, setDraft] = useState<ChecklistItem[]>(items);
  const [newItem, setNewItem] = useState('');
  const preambleRef = useRef(preamble);
  const tailRef = useRef(tail);

  useEffect(() => {
    setDraft(items);
    preambleRef.current = preamble;
    tailRef.current = tail;
  }, [items, preamble, tail]);

  const commit = (next: ChecklistItem[]) => {
    setDraft(next);
    const body = serializeChecklist(next, preambleRef.current, tailRef.current);
    onSave(body);
  };

  const toggle = (i: number) => {
    const next = draft.map((it, idx) => (idx === i ? { ...it, checked: !it.checked } : it));
    commit(next);
  };

  const updateText = (i: number, text: string) => {
    setDraft((prev) => prev.map((it, idx) => (idx === i ? { ...it, text } : it)));
  };

  const commitText = (i: number) => {
    const current = draft[i];
    if (!current) return;
    if (current.text.trim() === '') {
      commit(draft.filter((_, idx) => idx !== i));
      return;
    }
    commit(draft);
  };

  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    commit([...draft, { checked: false, text }]);
    setNewItem('');
  };

  if (draft.length === 0) {
    // Render placeholder items as ghost checkboxes so the empty state looks
    // like a task list. Clicking any ghost item commits the placeholder set
    // as the real list (with the clicked one toggled).
    const ghostItems = parseChecklist(placeholder).items;
    const seedFromGhost = (clickedIdx: number | null) => {
      const seeded = ghostItems.map((it, idx) => ({
        ...it,
        checked: idx === clickedIdx ? true : it.checked,
      }));
      commit(seeded);
    };
    return (
      <div className="space-y-1.5">
        {ghostItems.map((it, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 group rounded px-1 -mx-1 py-0.5 hover:bg-[var(--bg-hover)] opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
            onClick={() => seedFromGhost(i)}
          >
            <Checkbox
              size="sm"
              checked={false}
              onChange={() => seedFromGhost(i)}
              title="Start the list"
            />
            <span className="flex-1 text-sm text-[var(--fg-dim)]">{it.text}</span>
          </div>
        ))}
        <div className="pt-1">
          <NewItemRow value={newItem} onChange={setNewItem} onCommit={addItem} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {draft.map((it, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center gap-2.5 group rounded px-1 -mx-1 py-0.5',
            'hover:bg-[var(--bg-hover)]'
          )}
        >
          <Checkbox
            size="sm"
            checked={it.checked}
            onChange={() => toggle(i)}
            title={it.checked ? 'Mark incomplete' : 'Mark complete'}
          />
          <input
            value={it.text}
            onChange={(e) => updateText(i, e.target.value)}
            onBlur={() => commitText(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className={cn(
              'flex-1 bg-transparent outline-none text-sm',
              it.checked && 'line-through text-[var(--fg-dim)]'
            )}
          />
        </div>
      ))}
      <div className="pt-1">
        <NewItemRow value={newItem} onChange={setNewItem} onCommit={addItem} />
      </div>
    </div>
  );
}

function parseBulletList(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => {
      const m = line.match(/^\s*[-*]\s+(.+)$/);
      return m ? m[1].trim() : null;
    })
    .filter((x): x is string => !!x);
}

function serializeBulletList(items: string[]): string {
  return items.map((t) => `- ${t}`).join('\n');
}

function BulletListEditor({
  body,
  placeholder,
  onSave,
}: {
  body: string;
  placeholder: string;
  onSave: (body: string) => void | Promise<void>;
}) {
  const parsed = useMemo(() => parseBulletList(body), [body]);
  const [draft, setDraft] = useState<string[]>(parsed);
  const [newItem, setNewItem] = useState('');

  useEffect(() => {
    setDraft(parsed);
  }, [parsed]);

  const commit = (next: string[]) => {
    setDraft(next);
    onSave(serializeBulletList(next));
  };

  const updateText = (i: number, text: string) => {
    setDraft((prev) => prev.map((t, idx) => (idx === i ? text : t)));
  };

  const commitText = (i: number) => {
    const current = draft[i];
    if (current === undefined) return;
    if (current.trim() === '') {
      commit(draft.filter((_, idx) => idx !== i));
      return;
    }
    commit(draft);
  };

  const remove = (i: number) => {
    commit(draft.filter((_, idx) => idx !== i));
  };

  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    commit([...draft, text]);
    setNewItem('');
  };

  if (draft.length === 0) {
    const ghostItems = parseBulletList(placeholder);
    return (
      <div className="space-y-1.5">
        {ghostItems.map((t, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 rounded px-1 -mx-1 py-0.5 opacity-50"
          >
            <span
              className="w-1 h-1 rounded-full bg-[var(--fg-dim)] shrink-0 ml-1"
              aria-hidden
            />
            <span className="flex-1 text-sm text-[var(--fg-dim)]">{t}</span>
          </div>
        ))}
        <div className="pt-1">
          <NewItemRow value={newItem} onChange={setNewItem} onCommit={addItem} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {draft.map((t, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 group rounded px-1 -mx-1 py-0.5 hover:bg-[var(--bg-hover)]"
        >
          <span
            className="w-1 h-1 rounded-full bg-[var(--fg-dim)] shrink-0 ml-1"
            aria-hidden
          />
          <input
            value={t}
            onChange={(e) => updateText(i, e.target.value)}
            onBlur={() => commitText(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="opacity-0 group-hover:opacity-100 text-[var(--fg-dim)] hover:text-[var(--fg)] transition-opacity text-xs"
            aria-label="Remove item"
          >
            ×
          </button>
        </div>
      ))}
      <div className="pt-1">
        <NewItemRow value={newItem} onChange={setNewItem} onCommit={addItem} />
      </div>
    </div>
  );
}

function NewItemRow({
  value,
  onChange,
  onCommit,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit();
      }}
      onBlur={() => {
        if (value.trim()) onCommit();
      }}
      placeholder="Add item…"
      className="w-full bg-transparent outline-none text-sm text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
    />
  );
}
