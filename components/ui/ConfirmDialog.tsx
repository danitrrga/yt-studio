'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 z-[70]"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.12 }}
                className="fixed left-1/2 top-[30vh] -translate-x-1/2 z-[71] w-[min(420px,92vw)] rounded-md border bg-[var(--bg-raised)] p-5"
              >
                <div className="flex items-start gap-3">
                  {variant === 'danger' && (
                    <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[var(--red-wash)]">
                      <AlertTriangle className="w-4 h-4 text-[var(--red)]" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Dialog.Title className="text-base font-bold text-[var(--fg)]">
                      {title}
                    </Dialog.Title>
                    {description && (
                      <Dialog.Description className="text-sm text-[var(--fg-muted)] mt-1.5">
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-5">
                  <button
                    onClick={() => onOpenChange(false)}
                    className="px-3 h-8 rounded border bg-[var(--bg-raised)] hover:bg-[var(--bg-hover)] text-sm"
                  >
                    {cancelLabel}
                  </button>
                  <button
                    onClick={async () => {
                      await onConfirm();
                      onOpenChange(false);
                    }}
                    className={cn(
                      'px-3 h-8 rounded text-sm font-medium',
                      variant === 'danger'
                        ? 'bg-[var(--red)] text-white hover:opacity-90'
                        : 'bg-[var(--fg)] text-[var(--fg-inverse)] hover:bg-[var(--fg)]'
                    )}
                  >
                    {confirmLabel}
                  </button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
