'use client';

import { Command } from 'cmdk';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Film,
  LayoutDashboard,
  Library,
  Search,
  Plus,
  Keyboard,
  Trash2,
  FileText,
  Clock,
  Loader2,
  Activity,
} from 'lucide-react';
import { registerShortcut } from '@/lib/shortcuts';
import { useVideos } from '@/hooks/use-videos';
import { useGlobalSearch } from '@/hooks/use-search';
import { useMRU, type MRUEntry } from '@/hooks/use-mru';
import { useUI } from './UIProvider';
import { STATUS_LABELS, STATUS_SOLID_VAR } from '@/lib/status';
import { cn } from '@/lib/utils';
import './command-palette.css';

const TYPE_ICON: Record<MRUEntry['type'], typeof Film> = {
  video: Film,
  clip: Library,
  doc: FileText,
};

function hrefFor(entry: { slug: string; type: MRUEntry['type'] }) {
  if (entry.type === 'video') return `/videos/${entry.slug}`;
  if (entry.type === 'clip') return `/hub/${entry.slug}`;
  return `/hub/docs/${entry.slug}`;
}

function Snippet({ text, query }: { text: string; query: string }) {
  if (!query) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span className="text-[11px] text-[var(--fg-dim)] leading-snug">
      {text.slice(0, idx)}
      <mark className="bg-[var(--bg-selected)] text-[var(--fg)] rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </span>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();
  const { videos } = useVideos();
  const { results, isSearching, hasResults } = useGlobalSearch(search);
  const mru = useMRU();
  const ui = useUI();

  useEffect(() => {
    return registerShortcut({
      id: 'palette.open',
      keys: ['Mod', 'k'],
      scope: 'global',
      group: 'Navigation',
      label: 'Open command palette',
      run: () => setOpen((o) => !o),
    });
  }, []);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const go = (path: string) => {
    router.push(path);
    setOpen(false);
  };

  const isDeepSearch = search.trim().length >= 2;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[60]"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-[15vh] -translate-x-1/2 w-[min(620px,92vw)] z-[61]"
          >
            <Command
              label="Command palette"
              className="rounded-md border bg-[var(--bg-raised)] overflow-hidden"
            >
              <div className="flex items-center gap-2 border-b px-3 h-11">
                {isSearching ? (
                  <Loader2 className="w-4 h-4 text-[var(--fg-dim)] animate-spin" />
                ) : (
                  <Search className="w-4 h-4 text-[var(--fg-dim)]" />
                )}
                <Command.Input
                  autoFocus
                  placeholder="search videos, clips, docs, or jump to…"
                  value={search}
                  onValueChange={setSearch}
                  className="flex-1 bg-transparent outline-none text-[13px] text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
                />
                <kbd className="px-1.5 py-0.5 rounded border bg-[var(--bg-raised)] text-[10px] font-mono text-[var(--fg-dim)]">
                  Esc
                </kbd>
              </div>

              <Command.List className="max-h-[50vh] overflow-y-auto p-1.5">
                <Command.Empty className="px-3 py-8 text-center text-[13px] text-[var(--fg-dim)]">
                  {isSearching ? 'searching…' : 'no matches.'}
                </Command.Empty>

                {/* MRU — shown when query is empty */}
                {!isDeepSearch && mru.length > 0 && (
                  <Command.Group heading="Recent" className="command-group">
                    {mru.map((entry) => {
                      const Icon = TYPE_ICON[entry.type];
                      return (
                        <Command.Item
                          key={`mru-${entry.slug}-${entry.type}`}
                          value={`recent ${entry.title} ${entry.slug}`}
                          onSelect={() => go(hrefFor(entry))}
                          className="command-item"
                        >
                          <Clock className="w-3 h-3 text-[var(--fg-dim)] shrink-0" />
                          <Icon className="w-3.5 h-3.5 text-[var(--fg-muted)] shrink-0" />
                          <span className="flex-1 truncate text-[13px]">{entry.title || entry.slug}</span>
                          <span className="text-[10px] text-[var(--fg-dim)]">{entry.type}</span>
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                )}

                {/* Navigation — always visible */}
                <Command.Group heading="Navigation" className="command-group">
                  <NavItem icon={LayoutDashboard} label="Dashboard" onSelect={() => go('/')} />
                  <NavItem icon={Film} label="Videos" onSelect={() => go('/videos')} />
                  <NavItem icon={Library} label="Hub" onSelect={() => go('/hub')} />
                  <NavItem icon={Activity} label="Diagnostics" onSelect={() => go('/diagnostics')} />
                  <NavItem icon={Trash2} label="Trash" onSelect={() => go('/videos/trash')} />
                  <NavItem icon={Keyboard} label="Keyboard shortcuts" onSelect={() => { ui.setShortcutsOpen(true); setOpen(false); }} />
                </Command.Group>

                {/* Actions */}
                <Command.Group heading="Actions" className="command-group">
                  <NavItem
                    icon={Plus}
                    label="New video"
                    kbd={['C']}
                    onSelect={() => {
                      ui.setQuickAddOpen(true);
                      setOpen(false);
                    }}
                  />
                </Command.Group>

                {/* Deep search results — only when query >= 2 chars */}
                {isDeepSearch && hasResults && results && (
                  <>
                    {results.videos.length > 0 && (
                      <Command.Group heading={`Videos · ${results.videos.length}`} className="command-group">
                        {results.videos.map((v) => {
                          const solidVar = STATUS_SOLID_VAR[v.status] ?? STATUS_SOLID_VAR.idea;
                          return (
                            <Command.Item
                              key={`sv-${v.slug}`}
                              value={`video ${v.title} ${v.slug} ${v.snippet}`}
                              onSelect={() => go(`/videos/${v.slug}/script`)}
                              className="command-item"
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: `var(${solidVar})` }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] truncate">{v.title || v.slug}</div>
                                {v.matchField === 'body' && (
                                  <Snippet text={v.snippet} query={results.query} />
                                )}
                              </div>
                              <span className="text-[10px] text-[var(--fg-dim)] shrink-0">
                                {v.matchField === 'body' ? 'in script' : STATUS_LABELS[v.status] ?? v.status}
                              </span>
                            </Command.Item>
                          );
                        })}
                      </Command.Group>
                    )}

                    {results.clips.length > 0 && (
                      <Command.Group heading={`Clips · ${results.clips.length}`} className="command-group">
                        {results.clips.map((c) => (
                          <Command.Item
                            key={`sc-${c.slug}`}
                            value={`clip ${c.title} ${c.slug} ${c.snippet}`}
                            onSelect={() => go(`/hub/${c.slug}`)}
                            className="command-item"
                          >
                            <Library className="w-3.5 h-3.5 text-[var(--fg-muted)] shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] truncate">{c.title || c.slug}</div>
                              {c.matchField === 'body' && (
                                <Snippet text={c.snippet} query={results.query} />
                              )}
                            </div>
                            <span className="text-[10px] text-[var(--fg-dim)] shrink-0">
                              {c.source}
                            </span>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}

                    {results.docs.length > 0 && (
                      <Command.Group heading={`Docs · ${results.docs.length}`} className="command-group">
                        {results.docs.map((d) => (
                          <Command.Item
                            key={`sd-${d.slug}`}
                            value={`doc ${d.title} ${d.slug} ${d.snippet}`}
                            onSelect={() => go(`/hub/docs/${d.slug}`)}
                            className="command-item"
                          >
                            <FileText className="w-3.5 h-3.5 text-[var(--fg-muted)] shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] truncate">{d.title || d.slug}</div>
                              {d.matchField === 'body' && (
                                <Snippet text={d.snippet} query={results.query} />
                              )}
                            </div>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}
                  </>
                )}

                {/* Fallback video list — shown when no deep search or no results */}
                {!isDeepSearch && videos && videos.length > 0 && (
                  <Command.Group heading={`Videos · ${videos.length}`} className="command-group">
                    {videos.slice(0, 12).map((v) => {
                      const solidVar = STATUS_SOLID_VAR[v.frontmatter.status];
                      return (
                        <Command.Item
                          key={v.slug}
                          value={`${v.frontmatter.title} ${v.frontmatter.category} ${(v.frontmatter.tags ?? []).join(' ')} ${v.slug}`}
                          onSelect={() => go(`/videos/${v.slug}`)}
                          className="command-item"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: `var(${solidVar})` }}
                          />
                          <span className="flex-1 truncate text-[13px]">
                            {v.frontmatter.title || v.slug}
                          </span>
                          <span className="text-[10px] text-[var(--fg-dim)]">
                            {STATUS_LABELS[v.frontmatter.status]}
                          </span>
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function NavItem({
  icon: Icon,
  label,
  onSelect,
  kbd,
}: {
  icon: React.ElementType;
  label: string;
  onSelect: () => void;
  kbd?: string[];
}) {
  return (
    <Command.Item value={label} onSelect={onSelect} className="command-item">
      <Icon className="w-3.5 h-3.5 text-[var(--fg-muted)] shrink-0" />
      <span className="flex-1 text-[13px]">{label}</span>
      {kbd && (
        <span className="flex items-center gap-0.5">
          {kbd.map((k, i) => (
            <kbd
              key={i}
              className={cn(
                'px-1.5 py-0.5 rounded border bg-[var(--bg-raised)]',
                'text-[10px] font-mono text-[var(--fg-dim)]'
              )}
            >
              {k}
            </kbd>
          ))}
        </span>
      )}
    </Command.Item>
  );
}
