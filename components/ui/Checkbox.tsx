'use client';

import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CheckboxState = boolean | 'indeterminate';

export function Checkbox({
  checked,
  onChange,
  size = 'md',
  className,
  title,
  ariaLabel,
}: {
  checked: CheckboxState;
  onChange?: (next: boolean) => void;
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  const dim = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const iconDim = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  const isOn = checked === true || checked === 'indeterminate';

  const handleClick = (e: React.MouseEvent) => {
    if (!onChange) return; // let parent handler take over
    e.stopPropagation();
    onChange(!(checked === true));
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked === 'indeterminate' ? 'mixed' : checked}
      aria-label={ariaLabel}
      title={title}
      onClick={handleClick}
      className={cn(
        'inline-flex items-center justify-center rounded-[5px] border transition-colors',
        'cursor-pointer select-none',
        'active:scale-95',
        dim,
        isOn
          ? 'bg-[var(--fg)] border-[var(--fg)] text-[var(--fg-inverse)]'
          : 'bg-[var(--color-surface)]/80 border-[var(--color-fg-muted)]/40 hover:border-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)]',
        className
      )}
    >
      {checked === true && <Check className={cn(iconDim, 'stroke-[3]')} />}
      {checked === 'indeterminate' && <Minus className={cn(iconDim, 'stroke-[3]')} />}
    </button>
  );
}
