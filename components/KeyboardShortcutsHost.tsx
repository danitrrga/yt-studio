'use client';

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export function KeyboardShortcutsHost() {
  useKeyboardShortcuts();
  return null;
}
