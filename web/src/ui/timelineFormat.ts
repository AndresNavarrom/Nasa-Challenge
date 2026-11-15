// Text and choices of the timeline line under the planet (TimelineTrack.tsx),
// kept free of React so they can be tested in Node.

import type { LoadedLayer } from "../data/types";
import { dateLabelAt, frameIndexAt } from "../lib/timeline";
import { layerForChoice } from "./layerChoice";

/** True for a layer that changes over time (smoke, CO2, lightning); a static one (forest) has one date. */
export function isTimed(layer: LoadedLayer): boolean {
  return !layer.manifest.static && layer.manifest.dates.length > 1;
}

/**
 * The layer the timeline line is for: the one picked in the layer picker,
 * changing over time or not (a static layer shows a dimmed line with its one
 * period). Null on the plain Earth view or for an unknown value: no line.
 */
export function trackLayer(layers: readonly LoadedLayer[], activeChoiceId: string): LoadedLayer | null {
  return layerForChoice(layers, activeChoiceId);
}

/** Text a screen reader announces for the timeline: the date and which instant of how many. */
export function trackValueText(layer: LoadedLayer, position: number): string {
  const { manifest } = layer;
  const date = dateLabelAt(manifest, position);
  if (!isTimed(layer)) return `${date}, fixed layer`;
  const frame = frameIndexAt(position, manifest.dates.length);
  return `${date}, instant ${frame + 1} of ${manifest.dates.length}`;
}
