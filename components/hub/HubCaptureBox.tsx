'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import { captureClipRequest, useHubMutate } from '@/hooks/use-hub';
import { registerShortcut } from '@/lib/shortcuts';

export function HubCaptureBox() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mutate = useHubMutate();

  useEffect(() => {
    const cleanup = registerShortcut({
      id: 'hub.focusCapture',
      keys: ['n'],
      scope: 'hub',
      group: 'Hub',
      label: 'Focus capture box',
      when: () =>
        typeof window !== 'undefined' &&
        (window.location.pathname === '/hub' ||
          window.location.pathname.startsWith('/hub/')),
      run: () => inputRef.current?.focus(),
    });
    return cleanup;
  }, []);

  const submit = async () => {
    const value = url.trim();
    if (!value) return;
    if (busy) return;
    if (!/^https?:\/\//.test(value)) {
      toast.error('Paste a full URL (https://…)');
      return;
    }
    setBusy(true);
    setUrl('');
    try {
      await captureClipRequest(value);
      mutate();
      toast.success('Clip captured');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Capture failed');
      setUrl(value);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-[var(--color-surface)] focus-within:border-[var(--line-strong)] transition-colors h-11 px-3">
      <Plus className="w-4 h-4 text-[var(--color-fg-muted)] shrink-0" />
      <input
        ref={inputRef}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Paste any URL to capture inspiration…"
        className="flex-1 h-full bg-transparent outline-none text-sm placeholder:text-[var(--color-fg-muted)]"
        autoComplete="off"
        spellCheck={false}
        type="url"
        disabled={busy}
      />
      {busy && <Loader2 className="w-4 h-4 animate-spin text-[var(--color-fg-muted)]" />}
      <kbd className="hidden md:inline-flex items-center px-1.5 h-5 rounded border text-[10px] text-[var(--color-fg-muted)] font-mono">
        N
      </kbd>
    </div>
  );
}
