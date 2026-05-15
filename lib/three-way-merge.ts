/**
 * Pure 3-way merge primitive for the script body editor.
 *
 * Wraps `node-diff3` and produces an "app wins" merge: when a hunk
 * conflicts, local lines are kept and the rejected server lines are
 * surfaced via `conflictHunks` for UI display.
 *
 * Inputs are full file bodies (strings). Output is line-merged.
 */

// node-diff3 ships untyped — minimal local typing here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import { diff3Merge } from 'node-diff3';

export interface ConflictHunk {
  /** Local lines kept in the merge. */
  localLines: string[];
  /** Server lines rejected (surfaced for the banner). */
  serverLines: string[];
  /** Original common-ancestor lines, for context. */
  baseLines: string[];
}

export interface MergeResult {
  /** True when no overlapping conflicts. */
  ok: boolean;
  /** Best-effort merged body. App wins for conflicting hunks. */
  merged: string;
  conflictHunks: ConflictHunk[];
}

interface Diff3Region {
  ok?: string[];
  conflict?: {
    a: string[]; // local
    aIndex: number;
    o: string[]; // original / base
    oIndex: number;
    b: string[]; // server
    bIndex: number;
  };
}

export function threeWayMerge(
  base: string,
  local: string,
  server: string
): MergeResult {
  // diff3Merge signature: (mine, original, theirs)
  const regions = diff3Merge(local, base, server, {
    excludeFalseConflicts: true,
    stringSeparator: '\n',
  }) as Diff3Region[];

  const out: string[] = [];
  const conflictHunks: ConflictHunk[] = [];

  for (const r of regions) {
    if (r.ok) {
      out.push(...r.ok);
    } else if (r.conflict) {
      // App-wins: keep local lines.
      out.push(...r.conflict.a);
      conflictHunks.push({
        localLines: r.conflict.a,
        serverLines: r.conflict.b,
        baseLines: r.conflict.o,
      });
    }
  }

  return {
    ok: conflictHunks.length === 0,
    merged: out.join('\n'),
    conflictHunks,
  };
}
