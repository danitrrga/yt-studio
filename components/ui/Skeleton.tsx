import { cn } from '@/lib/utils';

type Variant = 'row' | 'card' | 'title' | 'text' | 'chip';

export function Skeleton({
  variant = 'text',
  count = 1,
  className,
}: {
  variant?: Variant;
  count?: number;
  className?: string;
}) {
  const items = Array.from({ length: count });
  return (
    <div className={cn('space-y-2', className)}>
      {items.map((_, i) => (
        <div
          key={i}
          className={cn(
            'relative overflow-hidden rounded-md bg-[var(--bg-raised)] animate-pulse',
            variant === 'row' && 'h-11 w-full',
            variant === 'card' && 'h-24 w-full',
            variant === 'title' && 'h-8 w-2/3',
            variant === 'text' && 'h-4 w-full',
            variant === 'chip' && 'h-5 w-16'
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-md border bg-[var(--bg-raised)] overflow-hidden">
      <div className="h-10 border-b bg-[var(--bg-raised)]" />
      <div className="divide-y divide-[var(--line-faint)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <div className="h-4 w-1/3 rounded bg-[var(--bg-raised)] animate-pulse" />
            <div className="h-5 w-16 rounded bg-[var(--bg-raised)] animate-pulse ml-auto" />
            <div className="h-4 w-12 rounded bg-[var(--bg-raised)] animate-pulse" />
            <div className="h-4 w-20 rounded bg-[var(--bg-raised)] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
