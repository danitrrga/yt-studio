'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle } from 'lucide-react';
import type { ConflictHunk } from '@/lib/three-way-merge';
import { cn } from '@/lib/utils';

export function ExternalDiffModal({
  open,
  onClose,
  hunks,
}: {
  open: boolean;
  onClose: () => void;
  hunks: ConflictHunk[];
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
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
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="fixed left-1/2 top-[8vh] -translate-x-1/2 z-[71] w-[min(900px,94vw)] max-h-[84vh] flex flex-col rounded-xl border bg-[var(--color-surface-elevated)]"
              >
                <div className="flex items-center justify-between gap-3 px-5 h-12 border-b">
                  <Dialog.Title className="text-sm font-semibold inline-flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[hsl(var(--color-overdue))]" />
                    External edits — conflicts kept your version
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-fg-secondary)]"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-5 py-3 text-xs text-[var(--color-fg-muted)] border-b">
                  {hunks.length} conflicting {hunks.length === 1 ? 'hunk' : 'hunks'}.
                  Your version is saved. Disk lines below are what was on disk —
                  copy any you want manually.
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {hunks.map((h, i) => (
                    <HunkCard key={i} hunk={h} index={i + 1} />
                  ))}
                </div>

                <div className="flex items-center justify-end px-5 h-12 border-t">
                  <button
                    onClick={onClose}
                    className="px-3 h-7 rounded text-xs font-medium bg-[var(--color-button-primary)] text-[var(--color-button-primary-fg)] hover:bg-[var(--color-button-primary-hover)]"
                  >
                    Got it
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

function HunkCard({ hunk, index }: { hunk: ConflictHunk; index: number }) {
  return (
    <div className="rounded-lg border bg-[var(--color-surface)]">
      <div className="px-3 h-8 border-b flex items-center font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--color-fg-muted)]">
        Hunk {index}
      </div>
      <div className="grid grid-cols-2 divide-x divide-[var(--color-border-subtle)]">
        <Pane label="Yours (kept)" lines={hunk.localLines} accent="kept" />
        <Pane label="Disk (rejected)" lines={hunk.serverLines} accent="rejected" />
      </div>
      {hunk.baseLines.length > 0 && (
        <details className="px-3 py-2 border-t">
          <summary className="font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--color-fg-muted)] cursor-pointer hover:text-[var(--color-fg)]">
            Common ancestor ({hunk.baseLines.length} lines)
          </summary>
          <pre className="mt-2 text-[11px] font-mono whitespace-pre-wrap text-[var(--color-fg-muted)]">
            {hunk.baseLines.join('\n')}
          </pre>
        </details>
      )}
    </div>
  );
}

function Pane({
  label,
  lines,
  accent,
}: {
  label: string;
  lines: string[];
  accent: 'kept' | 'rejected';
}) {
  return (
    <div className="p-3">
      <div
        className={cn(
          'font-mono text-[11px] font-medium uppercase tracking-wider mb-1.5',
          accent === 'kept'
            ? 'text-[hsl(var(--status-published))]'
            : 'text-[hsl(var(--color-overdue))]'
        )}
      >
        {label}
      </div>
      <pre className="text-[12px] font-mono whitespace-pre-wrap text-[var(--color-fg)] leading-relaxed">
        {lines.length > 0 ? lines.join('\n') : <span className="text-[var(--color-fg-muted)] italic">(empty)</span>}
      </pre>
    </div>
  );
}
