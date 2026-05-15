'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKey } from '@/lib/shortcuts';

export function EmptyState({
  icon: Icon,
  title,
  body,
  cta,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  cta?: {
    label: string;
    onClick: () => void;
    shortcut?: string[];
  };
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-16 px-6 rounded-lg border border-dashed',
        className
      )}
    >
      {Icon && (
        <div className="w-11 h-11 rounded-full flex items-center justify-center bg-[var(--color-surface-elevated)] mb-4">
          <Icon className="w-5 h-5 text-[var(--color-fg-muted)]" />
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--color-fg)] mb-1">{title}</h3>
      {body && <p className="text-sm text-[var(--color-fg-muted)] max-w-sm mb-4">{body}</p>}
      {cta && (
        <button
          onClick={cta.onClick}
          className="inline-flex items-center gap-2 px-3 h-8 rounded-md bg-[var(--color-button-primary)] text-[var(--color-button-primary-fg)] text-sm font-medium hover:bg-[var(--color-button-primary-hover)]"
        >
          {cta.label}
          {cta.shortcut && (
            <span className="flex items-center gap-0.5 ml-1">
              {cta.shortcut.map((k, i) => (
                <kbd
                  key={i}
                  className="px-1.5 py-0.5 rounded bg-black/20 text-[10px] font-mono"
                >
                  {formatKey(k)}
                </kbd>
              ))}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
