// Phase 0 foundation: shortcut registry.
// Single source of truth for keyboard bindings + `?` help overlay.

import { useSyncExternalStore } from 'react';

export type Scope = 'global' | 'list' | 'editor' | 'detail' | 'hub';

export interface ShortcutDef {
  id: string;
  keys: string[]; // e.g. ['Mod', 'k'] or ['?'] — 'Mod' maps to Cmd/Ctrl by platform
  scope: Scope;
  group: string; // display group for help overlay
  label: string;
  when?: () => boolean; // predicate; falsy = skip
  run: (e: KeyboardEvent) => void;
}

const registry = new Map<string, ShortcutDef>();
const listeners = new Set<() => void>();
let cachedSnapshot: ShortcutDef[] = [];

function notify() {
  cachedSnapshot = Array.from(registry.values());
  for (const l of listeners) l();
}

export function registerShortcut(def: ShortcutDef) {
  registry.set(def.id, def);
  notify();
  return () => {
    registry.delete(def.id);
    notify();
  };
}

export function getShortcuts(): ShortcutDef[] {
  return cachedSnapshot;
}

export function getShortcutsByGroup(): Record<string, ShortcutDef[]> {
  const out: Record<string, ShortcutDef[]> = {};
  for (const def of registry.values()) {
    (out[def.group] ||= []).push(def);
  }
  return out;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useShortcuts(): ShortcutDef[] {
  return useSyncExternalStore(subscribe, getShortcuts, getShortcuts);
}

/**
 * Platform-aware key label.
 * 'Mod' → 'Cmd' on macOS, 'Ctrl' elsewhere.
 */
export function formatKey(key: string): string {
  if (typeof navigator === 'undefined') return key;
  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
  if (key === 'Mod') return isMac ? '⌘' : 'Ctrl';
  if (key === 'Shift') return '⇧';
  if (key === 'Alt') return isMac ? '⌥' : 'Alt';
  if (key === 'Enter') return '↵';
  if (key === 'Escape') return 'Esc';
  return key.length === 1 ? key.toUpperCase() : key;
}

export function isMod(e: KeyboardEvent): boolean {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
  return isMac ? e.metaKey : e.ctrlKey;
}

export function matchesShortcut(def: ShortcutDef, e: KeyboardEvent): boolean {
  const keys = def.keys;
  const needMod = keys.includes('Mod');
  const needShift = keys.includes('Shift');
  const needAlt = keys.includes('Alt');
  const char = keys.filter((k) => !['Mod', 'Shift', 'Alt'].includes(k)).pop() ?? '';

  if (needMod !== isMod(e)) return false;
  if (needShift !== e.shiftKey) return false;
  if (needAlt !== e.altKey) return false;
  if (char.length === 1) {
    return e.key.toLowerCase() === char.toLowerCase();
  }
  return e.key === char;
}
