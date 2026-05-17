'use client';

import { useCallback, useRef } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Branded number input. Strips the default browser spinner and renders
 * Linear-grade chevron stepper buttons inside a unified bordered shell.
 *
 * - `value` may be `null` for "empty" state (renders blank, allows clearing)
 * - `step` defaults to 1 · `min` / `max` clamp on commit
 * - Hold-to-repeat: clicks fire on each press; longpress ramps every 80ms
 *   after a 250ms initial delay (browser-style)
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  disabled,
  className,
  width = 'w-20',
  ariaLabel,
}: {
  value: number | null | undefined;
  onChange: (next: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Tailwind width utility for the input portion (e.g. `w-20`, `w-24`). */
  width?: string;
  ariaLabel?: string;
}) {
  const repeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clamp = useCallback(
    (n: number) => {
      let r = n;
      if (typeof min === 'number' && r < min) r = min;
      if (typeof max === 'number' && r > max) r = max;
      return r;
    },
    [min, max]
  );

  const bump = useCallback(
    (dir: 1 | -1) => {
      const base = typeof value === 'number' ? value : (min ?? 0);
      const next = clamp(base + dir * step);
      onChange(next);
    },
    [value, step, min, clamp, onChange]
  );

  const startRepeat = (dir: 1 | -1) => {
    bump(dir);
    repeatTimer.current = setTimeout(() => {
      repeatInterval.current = setInterval(() => bump(dir), 80);
    }, 250);
  };
  const stopRepeat = () => {
    if (repeatTimer.current) clearTimeout(repeatTimer.current);
    if (repeatInterval.current) clearInterval(repeatInterval.current);
    repeatTimer.current = null;
    repeatInterval.current = null;
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      onChange(null);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange(clamp(n));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      bump(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      bump(-1);
    }
  };

  const atMax = typeof max === 'number' && typeof value === 'number' && value >= max;
  const atMin = typeof min === 'number' && typeof value === 'number' && value <= min;

  return (
    <div
      className={cn(
        'inline-flex items-stretch h-8 rounded-md border bg-[var(--bg-raised)]',
        'focus-within:ring-1',
        'transition-colors',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      <input
        type="text"
        inputMode="numeric"
        pattern="-?[0-9]*"
        value={value ?? ''}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          width,
          'bg-transparent outline-none text-[13px] text-right tabular-nums px-2',
          'placeholder:text-[var(--fg-dim)]'
        )}
      />
      <div className="flex flex-col border-l border-[var(--line-faint)]">
        <Stepper
          dir={1}
          disabled={disabled || atMax}
          onPress={() => startRepeat(1)}
          onRelease={stopRepeat}
        >
          <ChevronUp className="w-3 h-3" />
        </Stepper>
        <Stepper
          dir={-1}
          disabled={disabled || atMin}
          onPress={() => startRepeat(-1)}
          onRelease={stopRepeat}
        >
          <ChevronDown className="w-3 h-3" />
        </Stepper>
      </div>
    </div>
  );
}

function Stepper({
  dir,
  children,
  onPress,
  onRelease,
  disabled,
}: {
  dir: 1 | -1;
  children: React.ReactNode;
  onPress: () => void;
  onRelease: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        onPress();
      }}
      onPointerUp={onRelease}
      onPointerLeave={onRelease}
      onPointerCancel={onRelease}
      disabled={disabled}
      aria-label={dir === 1 ? 'Increment' : 'Decrement'}
      className={cn(
        'flex-1 w-5 inline-flex items-center justify-center text-[var(--fg-dim)]',
        'hover:text-[var(--fg)] hover:bg-[var(--bg-hover)]',
        'transition-colors first:rounded-tr-md last:rounded-br-md',
        'border-b border-[var(--line-faint)] last:border-b-0',
        disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-[var(--fg-dim)]'
      )}
    >
      {children}
    </button>
  );
}
