// Text and values shown by the timeline bar (TimelineBar.tsx), kept free of
// React so they can be tested in Node.

import type { LoadedLayer } from "../data/types";
import { clampPosition } from "../lib/timeline";

/** Step of the position slider (0..1): fine enough to land on any instant. */
export const SCRUB_STEP = 0.001;

/** Layers that change over time (smoke, CO2): the ones whose date the bar shows. */
export function timedLayers(layers: readonly LoadedLayer[]): LoadedLayer[] {
  return layers.filter((layer) => !layer.manifest.static && layer.manifest.dates.length > 1);
}

/** Position as a whole percentage, "0 %" to "100 %". */
export function formatPercent(position: number): string {
  return `${Math.round(clampPosition(position) * 100)} %`;
}

/** Text a screen reader announces for the position slider. */
export function scrubValueText(position: number): string {
  return `Timeline at ${formatPercent(position)}`;
}
