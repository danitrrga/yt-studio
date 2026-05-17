'use client';

import { useState } from 'react';
import { AlertCircle, Eye } from 'lucide-react';
import type { ConflictHunk } from '@/lib/three-way-merge';
import { ExternalDiffModal } from '@/components/detail/ExternalDiffModal';

export function ConflictBanner({
  onReload,
  onKeep,
  conflictHunks,
}: {
  onReload: () => void;
  onKeep: () => void;
  conflictHunks?: ConflictHunk[];
}) {
  const [diffOpen, setDiffOpen] = useState(false);
  const hasHunks = conflictHunks && conflictHunks.length > 0;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-[color-mix(in_srgb,var(--status-review-color)_40%,transparent)] bg-[var(--status-review-tint)] text-sm mb-3">
      <AlertCircle className="w-4 h-4 shrink-0 text-[var(--status-review-color)]" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[var(--fg)]">
          {hasHunks
            ? `External edits conflict (${conflictHunks!.length} ${conflictHunks!.length === 1 ? 'hunk' : 'hunks'})`
            : 'File changed outside the app'}
        </div>
        <div className="text-xs text-[var(--fg-dim)]">
          {hasHunks
            ? 'Your version is saved. Disk lines were rejected — view diff to copy any manually.'
            : 'You have unsaved changes. Reload loses them. Keep overwrites the file on next save.'}
        </div>
      </div>
      {hasHunks && (
        <button
          onClick={() => setDiffOpen(true)}
          className="px-2.5 h-7 rounded border text-xs inline-flex items-center gap-1.5 hover:bg-[var(--bg-hover)]"
        >
          <Eye className="w-3 h-3" />
          View diff
        </button>
      )}
      <button
        onClick={onReload}
        className="px-2.5 h-7 rounded border text-xs hover:bg-[var(--bg-hover)]"
      >
        Reload
      </button>
      <button
        onClick={onKeep}
        className="px-2.5 h-7 rounded text-xs bg-[var(--status-review-color)] text-[var(--fg-inverse)] font-medium hover:opacity-90"
      >
        Keep draft
      </button>
      {hasHunks && (
        <ExternalDiffModal
          open={diffOpen}
          onClose={() => setDiffOpen(false)}
          hunks={conflictHunks!}
        />
      )}
    </div>
  );
}
