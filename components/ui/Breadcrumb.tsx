import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav
      className={cn('flex items-center gap-1.5 text-sm min-w-0', className)}
      aria-label="Breadcrumb"
    >
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && (
              <ChevronRight className="w-3 h-3 text-[var(--fg-dim)] shrink-0" />
            )}
            {item.href && !last ? (
              <Link
                href={item.href}
                className="text-[var(--fg-dim)] hover:text-[var(--fg)] shrink-0"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn('truncate', last ? 'text-[var(--fg)] font-medium' : 'text-[var(--fg-dim)]')}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
