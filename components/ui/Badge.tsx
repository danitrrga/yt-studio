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
  const style = colorVar
    ? {
        backgroundColor: `hsl(var(${colorVar}) / 0.15)`,
        color: `hsl(var(${colorVar}))`,
        borderColor: `hsl(var(${colorVar}) / 0.3)`,
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
