'use client';

import type { VideoStatus } from '@/lib/types';
import { STATUS_SOLID_VAR, STATUS_TINT_VAR, STATUS_LABELS } from '@/lib/status';
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
  const solidVar = STATUS_SOLID_VAR[status];
  const tintVar  = STATUS_TINT_VAR[status];
  const isSm = size === 'sm';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium uppercase tracking-[0.08em]',
        isSm ? 'px-2 h-[18px] text-[10px]' : 'px-[10px] h-[22px] text-[11px]',
        className
      )}
      style={{
        backgroundColor: `var(${tintVar})`,
        color: `var(${solidVar})`,
        borderColor: `color-mix(in srgb, var(${solidVar}) 30%, transparent)`,
      }}
    >
      <span
        className="rounded-full shrink-0"
        style={{
          width: isSm ? 4 : 6,
          height: isSm ? 4 : 6,
          backgroundColor: `var(${solidVar})`,
        }}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
