'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, readSettings, writeSettings, type UserSettings } from '@/lib/settings';

export function useSettings(): {
  settings: UserSettings;
  update: (patch: Partial<UserSettings>) => void;
} {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    setSettings(readSettings());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<UserSettings>).detail;
      if (detail) setSettings(detail);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'yts:settings:v1') setSettings(readSettings());
    };
    window.addEventListener('yts:settings:changed', onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('yts:settings:changed', onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const update = (patch: Partial<UserSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    writeSettings(next);
  };

  return { settings, update };
}
