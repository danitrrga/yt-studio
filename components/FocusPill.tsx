'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Focus, Maximize2, Minimize2 } from 'lucide-react';
import { useUI } from './UIProvider';

export function FocusPill() {
  const { focus, toggleFocus, fullscreen, toggleFullscreen } = useUI();
  return (
    <AnimatePresence>
      {focus && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.15 }}
          className="fixed bottom-4 right-4 z-30 flex items-center gap-1.5 bg-[var(--bg-raised)] border rounded-full px-2 py-1"
        >
          <span className="pl-2 pr-1 text-[11px] font-medium text-[var(--fg-muted)] flex items-center gap-1.5">
            <Focus className="w-3 h-3" />
            Focus
          </span>
          <button
            onClick={toggleFullscreen}
            title={fullscreen ? 'Exit fullscreen (Shift+F)' : 'Enter fullscreen (Shift+F)'}
            className="p-1.5 rounded-full hover:bg-[var(--bg-hover)] text-[var(--fg-muted)]"
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={toggleFocus}
            title="Exit focus (Esc)"
            className="pr-2 pl-1 text-[11px] font-medium text-[var(--fg-dim)] hover:text-[var(--fg)]"
          >
            Esc
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
