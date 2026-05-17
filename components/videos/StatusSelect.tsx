'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/Select';
import { STATUS_ORDER, STATUS_LABELS, STATUS_SOLID_VAR } from '@/lib/status';
import type { VideoStatus } from '@/lib/types';

export function StatusSelect({
  value,
  onChange,
}: {
  value: VideoStatus;
  onChange: (next: VideoStatus) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as VideoStatus)}>
      <SelectTrigger className="h-7 w-fit">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-medium"
          style={{ color: `var(${STATUS_SOLID_VAR[value]})` }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: `var(${STATUS_SOLID_VAR[value]})` }}
          />
          <SelectPrimitive.Value>{STATUS_LABELS[value]}</SelectPrimitive.Value>
        </span>
      </SelectTrigger>
      <SelectContent>
        {STATUS_ORDER.map((s) => (
          <SelectItem key={s} value={s}>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: `var(${STATUS_SOLID_VAR[s]})` }}
              />
              {STATUS_LABELS[s]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
