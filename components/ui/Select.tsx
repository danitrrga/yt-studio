'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      {...props}
      className={cn(
        'flex items-center justify-between gap-2 h-8 px-2.5 rounded-md border bg-[var(--color-surface)] text-sm text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)] transition-colors outline-none',
        className
      )}
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        {...props}
        position="popper"
        sideOffset={4}
        className={cn(
          'z-50 min-w-[160px] rounded-md border bg-[var(--color-surface-elevated)] overflow-hidden p-1',
          className
        )}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      {...props}
      className={cn(
        'relative flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer outline-none hover:bg-[var(--color-surface-hover)] data-[state=checked]:text-[var(--fg)]',
        className
      )}
    >
      <SelectPrimitive.ItemIndicator>
        <Check className="w-3.5 h-3.5" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
