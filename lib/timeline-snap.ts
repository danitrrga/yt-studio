/**
 * dnd-kit modifier that snaps drag transform's x to whole-day increments.
 *
 * Y-axis policy:
 *   - span bars + markers (already on the timeline) → locked to their row (y=0)
 *   - NoDate chips travelling from the strip into the body → free Y
 *
 * Pure factory; no closures over mutable state.
 */

import type { Modifier } from '@dnd-kit/core';

export function createDaySnapModifier(pxPerDay: number): Modifier {
  return ({ transform, active }) => {
    const id = active?.id?.toString() ?? '';
    const freeY = id.endsWith('::nodate');
    return {
      ...transform,
      x: Math.round(transform.x / pxPerDay) * pxPerDay,
      y: freeY ? transform.y : 0,
    };
  };
}
