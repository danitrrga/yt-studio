'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TextareaFallback({
  draft,
  onChange,
  errorMessage,
  onRetryMount,
  writingMode = false,
}: {
  draft: string;
  onChange: (value: string) => void;
  errorMessage?: string;
  onRetryMount?: () => void;
  writingMode?: boolean;
}) {
  const [value, setValue] = useState(draft);
  useEffect(() => {
    setValue(draft);
  }, [draft]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {errorMessage && (
        <div className="flex items-start gap-3 p-3 rounded-md border border-[hsl(var(--color-overdue)/0.4)] bg-[hsl(var(--color-overdue)/0.1)] text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[hsl(var(--color-overdue))]" />
          <div className="flex-1">
            <div className="font-medium text-[var(--color-fg)]">Rich editor failed to load</div>
            <div className="text-xs text-[var(--color-fg-muted)] mt-0.5">{errorMessage}</div>
            <div className="text-xs text-[var(--color-fg-muted)] mt-1">Using plain text editor — saves still work.</div>
          </div>
          {onRetryMount && (
            <button
              onClick={onRetryMount}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-[var(--color-surface-hover)]"
            >
              <RotateCcw className="w-3 h-3" />
              Retry
            </button>
          )}
        </div>
      )}
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onChange(e.target.value);
        }}
        spellCheck={false}
        className={cn(
          'w-full flex-1 min-h-[50vh] rounded-md border bg-[var(--color-surface-elevated)] p-4 outline-none resize-none',
          writingMode
            ? 'font-sans text-[17px] leading-[1.75] border-transparent bg-transparent'
            : 'font-mono text-sm leading-relaxed'
        )}
      />
    </div>
  );
}
