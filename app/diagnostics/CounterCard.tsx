'use client';

import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'good' | 'warn' | 'bad';

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-[var(--fg)]',
  good: 'text-[var(--status-published-color)]',
  warn: 'text-[var(--status-warn-color)]',
  bad: 'text-[var(--red)]',
};

const TONE_BAR: Record<Tone, string> = {
  neutral: 'bg-[var(--fg-muted)]',
  good: 'bg-[var(--status-published-color)]',
  warn: 'bg-[var(--status-warn-color)]',
  bad: 'bg-[var(--red)]',
};

export function CounterCard({
  label,
  value,
  tone = 'neutral',
  sparkline,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone?: Tone;
  sparkline?: number[];
  active?: boolean;
  onClick?: () => void;
}) {
  const max = sparkline?.length ? Math.max(1, ...sparkline) : 1;

  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        'rounded-md border bg-[var(--bg-raised)] p-4 text-left transition-colors',
        onClick ? 'hover:bg-[var(--bg-hover)] cursor-pointer' : 'cursor-default',
        active && 'ring-1 ring-[var(--line-strong)] bg-[var(--bg-hover)]'
      )}
    >
      <div className="font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)]">
        {label}
      </div>
      <div className={cn('mt-2 text-3xl font-bold tabular-nums leading-none', TONE_TEXT[tone])}>
        {value}
      </div>
      {sparkline && sparkline.length > 0 && (
        <div className="mt-3 flex items-end gap-0.5 h-6">
          {sparkline.map((v, i) => (
            <span
              key={i}
              className={cn('flex-1 rounded-sm', v > 0 ? TONE_BAR[tone] : 'bg-[var(--line-faint)]')}
              style={{
                height: v > 0 ? `${Math.max(8, (v / max) * 100)}%` : '12%',
                opacity: v > 0 ? 1 : 0.4,
              }}
            />
          ))}
        </div>
      )}
    </button>
  );
}
