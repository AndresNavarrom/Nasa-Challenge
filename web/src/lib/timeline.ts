// One shared timeline position, 0..1, drives every layer (FR7). Each layer walks
// through its own period: smoke and CO2 have several instants, the forest is fixed.

import type { LayerManifest } from "../data/types";

/** Limits a timeline position to 0..1; anything that is not a number counts as 0. */
export function clampPosition(position: number): number {
  if (Number.isNaN(position)) return 0;
  return Math.min(1, Math.max(0, position));
}

/** Fractional frame index (0..frames-1) for a timeline position (0..1). */
export function framePosition(position: number, frames: number): number {
  if (!Number.isFinite(frames) || frames <= 1) return 0;
  return clampPosition(position) * (frames - 1);
}

type Dated = Pick<LayerManifest, "static" | "dates">;

/** Date label shown for a layer at a timeline position: the nearest instant's label. */
export function dateLabelAt(layer: Dated, position: number): string {
  if (layer.dates.length === 0) return "";
  if (layer.static) return layer.dates[0] ?? "";
  const index = Math.round(framePosition(position, layer.dates.length));
  return layer.dates[index] ?? "";
}

/**
 * Next timeline position after `deltaSeconds` of playback when the whole
 * sequence lasts `durationSeconds`. Loops back to the start by default.
 */
export function advancePosition(
  position: number,
  deltaSeconds: number,
  durationSeconds: number,
  loop = true,
): number {
  if (!(durationSeconds > 0) || !Number.isFinite(deltaSeconds)) return clampPosition(position);
  const next = clampPosition(position) + Math.max(0, deltaSeconds) / durationSeconds;
  if (next < 1) return next;
  return loop ? next % 1 : 1;
}
