'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Film, Library, ChevronsLeft, ChevronsRight, Inbox as InboxIcon, Settings as SettingsIcon, Hammer, Clock, Map as MapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUI } from './UIProvider';
import { Tooltip } from './ui/Tooltip';
import { StatusPill } from './StatusPill';
import { useIdeaCount } from '@/hooks/use-videos';
import { useHubClipCount } from '@/hooks/use-hub';
import { BUILTIN_VIEWS, type SavedView } from '@/lib/saved-views';
import type { LucideIcon } from 'lucide-react';

// Sidebar surfaces only the top 3 built-in views — kept simple and stable.
// Each gets its own distinctive icon so they read at a glance.
const SIDEBAR_VIEWS: { view: SavedView; icon: LucideIcon }[] = [
  { view: BUILTIN_VIEWS.find((v) => v.id === 'builtin-in-production')!, icon: Hammer },
  { view: BUILTIN_VIEWS.find((v) => v.id === 'builtin-up-next')!, icon: Clock },
  { view: BUILTIN_VIEWS.find((v) => v.id === 'builtin-roadmap')!, icon: MapIcon },
];

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/videos', label: 'Videos', icon: Film },
  { href: '/hub', label: 'Hub', icon: Library },
];

// Active preset key from the URL — matches `?v=<key>` for inbox + builtins.
// Returns null when the URL has no preset (raw `/videos` or a base64 payload).
const PRESET_KEYS = ['inbox', 'in-production', 'up-next', 'roadmap'];
function useActivePresetKey(): string | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (pathname !== '/videos') return null;
  const v = searchParams.get('v');
  return v && PRESET_KEYS.includes(v) ? v : null;
}

function PresetActiveProbe({ onChange }: { onChange: (key: string | null) => void }) {
  const active = useActivePresetKey();
  useEffect(() => {
    onChange(active);
  }, [active, onChange]);
  return null;
}

export default function Sidebar() {
  const pathname = usePathname();
  const ideaCount = useIdeaCount();
  const hubCount = useHubClipCount();
  const { sidebarCollapsed: stateCollapsed, toggleSidebar } = useUI();
  const [narrow, setNarrow] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const inboxActive = activePreset === 'inbox';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 1024px)');
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const collapsed = stateCollapsed || narrow;

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 240 }}
      initial={false}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      className="shrink-0 border-r border-[var(--color-border-subtle)] bg-[var(--color-surface)] flex flex-col overflow-hidden"
    >
      <Suspense fallback={null}>
        <PresetActiveProbe onChange={setActivePreset} />
      </Suspense>
      <div
        className={cn(
          'h-14 flex items-center border-b border-[var(--color-border-subtle)]',
          collapsed ? 'px-3 justify-center' : 'px-5'
        )}
      >
        {collapsed ? (
          <span
            className="font-bold leading-none select-none"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 16 }}
          >
            yt<span style={{ color: 'var(--red)' }}>/</span>
          </span>
        ) : (
          <span
            className="font-bold leading-none tracking-tight select-none"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 19 }}
          >
            yt<span style={{ color: 'var(--red)' }}>/</span>studio
          </span>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          // /videos is considered active only when no preset is active.
          // Each preset (inbox / in-production / up-next / roadmap) owns its own active row below.
          const baseActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          const active = href === '/videos' ? baseActive && activePreset === null : baseActive;
          const isHub = href === '/hub';
          const link = (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md text-sm transition-colors',
                collapsed ? 'h-9 justify-center' : 'px-3 py-2',
                active
                  ? 'bg-[var(--bg-selected)] text-[var(--fg)]'
                  : 'text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="flex-1">{label}</span>}
              {!collapsed && isHub && hubCount > 0 && (
                <span className="text-[10px] tabular-nums rounded bg-[var(--color-surface-elevated)] px-1.5 py-0.5 text-[var(--color-fg-muted)]">
                  {hubCount}
                </span>
              )}
            </Link>
          );
          const linkWithNest =
            href === '/videos' ? (
              <div key={href}>
                {collapsed ? (
                  <Tooltip content={label}>{link}</Tooltip>
                ) : (
                  link
                )}
                {!collapsed && (
                  <Link
                    href="/videos?v=inbox"
                    className={cn(
                      'flex items-center gap-3 rounded-md text-sm transition-colors pl-9 pr-3 py-1.5 mt-0.5 border-l-2',
                      inboxActive
                        ? 'bg-[var(--bg-selected)] text-[var(--fg)] border-[var(--red)]'
                        : 'text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)] border-transparent'
                    )}
                  >
                    <InboxIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="flex-1">Inbox</span>
                    {ideaCount > 0 && (
                      <span className="text-[10px] tabular-nums rounded bg-[var(--color-surface-elevated)] px-1.5 py-0.5 text-[var(--color-fg-muted)]">
                        {ideaCount}
                      </span>
                    )}
                  </Link>
                )}
                {collapsed && (
                  <Tooltip content={`Inbox${ideaCount > 0 ? ` · ${ideaCount}` : ''}`}>
                    <Link
                      href="/videos?v=inbox"
                      className={cn(
                        'flex items-center justify-center h-9 rounded-md transition-colors mt-0.5 relative',
                        inboxActive
                          ? 'bg-[var(--bg-selected)] text-[var(--fg)]'
                          : 'text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]'
                      )}
                    >
                      <InboxIcon className="w-4 h-4 shrink-0" />
                      {ideaCount > 0 && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--red)]" />
                      )}
                    </Link>
                  </Tooltip>
                )}
                {!collapsed && (
                  <div className="mt-1 space-y-0.5">
                    {SIDEBAR_VIEWS.map(({ view: sv, icon: ViewIcon }) => {
                      const isActive = activePreset === sv.urlKey;
                      return (
                        <Link
                          key={sv.id}
                          href={`/videos?v=${sv.urlKey}`}
                          className={cn(
                            'flex items-center gap-3 rounded-md text-sm transition-colors pl-9 pr-3 py-1.5 border-l-2',
                            isActive
                              ? 'bg-[var(--bg-selected)] text-[var(--fg)] border-[var(--red)]'
                              : 'text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)] border-transparent'
                          )}
                        >
                          <ViewIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="flex-1 truncate text-left">{sv.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : collapsed ? (
              <Tooltip key={href} content={label}>
                {link}
              </Tooltip>
            ) : (
              link
            );
          return linkWithNest;
        })}
      </nav>

      <div
        className={cn(
          'border-t border-[var(--color-border-subtle)] flex items-center',
          collapsed ? 'flex-col gap-1 p-2' : 'justify-between p-3 gap-2'
        )}
      >
        <StatusPill collapsed={collapsed} />
        <div className={cn('flex items-center gap-1 shrink-0', collapsed && 'flex-col')}>
          <Tooltip content="Settings" side={collapsed ? 'right' : 'top'}>
            <Link
              href="/settings"
              className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--fg-dim)] hover:text-[var(--fg)]"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
            </Link>
          </Tooltip>
          <Tooltip content={collapsed ? 'Expand · ⌘\\' : 'Collapse · ⌘\\'} side={collapsed ? 'right' : 'top'}>
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--fg-dim)] hover:text-[var(--fg)]"
            >
              {collapsed ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
            </button>
          </Tooltip>
        </div>
      </div>
    </motion.aside>
  );
}
