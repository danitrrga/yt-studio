'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from './UIProvider';
import { formatKey, useShortcuts } from '@/lib/shortcuts';

export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = useUI();
  const shortcuts = useShortcuts();

  const byGroup = shortcuts.reduce<Record<string, typeof shortcuts>>((acc, s) => {
    (acc[s.group] ||= []).push(s);
    return acc;
  }, {});

  return (
    <Dialog.Root open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <AnimatePresence>
        {shortcutsOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 z-50"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[480px] max-h-[80vh] overflow-y-auto rounded-xl border bg-[var(--color-surface-elevated)] p-6"
              >
                <Dialog.Title className="font-mono text-sm font-medium uppercase tracking-wider text-[var(--color-fg-muted)] mb-4">
                  Keyboard shortcuts
                </Dialog.Title>

                <div className="space-y-5">
                  {Object.entries(byGroup).map(([group, list]) => (
                    <div key={group}>
                      <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-fg-muted)] mb-2">
                        {group}
                      </div>
                      <div className="space-y-1.5">
                        {list.map((s) => (
                          <div key={s.id} className="flex items-center justify-between text-sm py-1">
                            <span className="text-[var(--color-fg-secondary)]">{s.label}</span>
                            <div className="flex items-center gap-1">
                              {s.keys.map((k, i) => (
                                <kbd
                                  key={i}
                                  className="px-1.5 py-0.5 rounded border bg-[var(--color-surface)] text-xs font-mono text-[var(--color-fg)]"
                                >
                                  {formatKey(k)}
                                </kbd>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-[var(--color-fg-muted)] mt-5 pt-4 border-t">
                  Shortcuts ignore input fields + editor.
                </p>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
