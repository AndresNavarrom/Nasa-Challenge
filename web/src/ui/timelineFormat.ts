// Text and values shown by the timeline bar (TimelineBar.tsx), kept free of
// React so they can be tested in Node.

import type { LoadedLayer } from "../data/types";
import { MAX_SPEED, MIN_SPEED } from "../lib/playback";
import { clampPosition } from "../lib/timeline";

/** Step of the position slider (0..1): fine enough to land on any instant. */
export const SCRUB_STEP = 0.001;
/** Step of the speed slider (0.1x..8x). */
export const SPEED_STEP = 0.1;

/** Layers that change over time (smoke, CO2): the ones whose date the bar shows. */
export function timedLayers(layers: readonly LoadedLayer[]): LoadedLayer[] {
  return layers.filter((layer) => !layer.manifest.static && layer.manifest.dates.length > 1);
}

/** Position as a whole percentage, "0 %" to "100 %". */
export function formatPercent(position: number): string {
  return `${Math.round(clampPosition(position) * 100)} %`;
}

/** Speed as shown next to its slider: "0.1×" to "8.0×". */
export function formatSpeed(speed: number): string {
  const safe = Number.isFinite(speed) ? Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed)) : 1;
  return `${safe.toFixed(1)}×`;
}

/** Seconds as "m:ss", to the nearest second. */
function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * Elapsed and total time of the sequence at the current speed, "0:06 / 0:24".
 * At 2x the same sequence lasts half as long, so both numbers shrink.
 */
export function formatElapsed(position: number, durationSeconds: number, speed: number): string {
  const safeSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1;
  const total = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds / safeSpeed : 0;
  return `${clock(clampPosition(position) * total)} / ${clock(total)}`;
}

/** Text a screen reader announces for the position slider. */
export function scrubValueText(position: number): string {
  return `Timeline at ${formatPercent(position)}`;
}
