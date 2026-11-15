// Text and values shown by the timeline bar (TimelineBar.tsx), kept free of
// React so they can be tested in Node.

import type { LoadedLayer } from "../data/types";
import { clampPosition } from "../lib/timeline";
import { layerForChoice } from "./layerChoice";

/** Step of the position slider (0..1): fine enough to land on any instant. */
export const SCRUB_STEP = 0.001;

/** True for a layer that changes over time (smoke, CO2); static ones (forest, lightning) have one date. */
export function isTimed(layer: LoadedLayer): boolean {
  return !layer.manifest.static && layer.manifest.dates.length > 1;
}

/**
 * The layer the timeline bar is for: the one picked in the layer picker, when
 * it changes over time. Null for a static layer, the plain Earth view or an
 * unknown value, and then the bar is not shown at all.
 */
export function timelineLayer(layers: readonly LoadedLayer[], activeChoiceId: string): LoadedLayer | null {
  const layer = layerForChoice(layers, activeChoiceId);
  return layer && isTimed(layer) ? layer : null;
}

/** Position as a whole percentage, "0 %" to "100 %". */
export function formatPercent(position: number): string {
  return `${Math.round(clampPosition(position) * 100)} %`;
}

/** Text a screen reader announces for the position slider. */
export function scrubValueText(position: number): string {
  return `Timeline at ${formatPercent(position)}`;
}
