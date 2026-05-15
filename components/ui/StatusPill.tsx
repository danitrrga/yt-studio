'use client';

import type { VideoStatus } from '@/lib/types';
import { STATUS_COLOR_VAR, STATUS_LABELS } from '@/lib/status';
import { cn } from '@/lib/utils';

export function StatusPill({
  status,
  size = 'md',
  className,
}: {
  status: VideoStatus;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const colorVar = STATUS_COLOR_VAR[status];
  const isSm = size === 'sm';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium uppercase tracking-[0.08em]',
        isSm ? 'px-2 h-[18px] text-[10px]' : 'px-[10px] h-[22px] text-[11px]',
        className
      )}
      style={{
        backgroundColor: `hsl(var(${colorVar}) / 0.12)`,
        color: `hsl(var(${colorVar}))`,
        borderColor: `hsl(var(${colorVar}) / 0.3)`,
      }}
    >
      <span
        className="rounded-full shrink-0"
        style={{
          width: isSm ? 4 : 6,
          height: isSm ? 4 : 6,
          backgroundColor: `hsl(var(${colorVar}))`,
        }}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
