import { cn } from '@/lib/utils';

export function Badge({
  children,
  className,
  colorVar,
}: {
  children: React.ReactNode;
  className?: string;
  colorVar?: string;
}) {
  // colorVar is expected to be a --status-X-color token; derive tint from solid color
  const style = colorVar
    ? {
        backgroundColor: `color-mix(in srgb, var(${colorVar}) 15%, transparent)`,
        color: `var(${colorVar})`,
        borderColor: `color-mix(in srgb, var(${colorVar}) 30%, transparent)`,
      }
    : undefined;
  return (
    <span
      style={style}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium',
        !colorVar && 'bg-[var(--bg-raised)] text-[var(--fg-muted)] border-[var(--line)]',
        className
      )}
    >
      {children}
    </span>
  );
}
