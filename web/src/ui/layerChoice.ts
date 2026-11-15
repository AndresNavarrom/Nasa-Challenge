// The layer picker's choices: "Earth" (the planet alone, no data layer drawn)
// first and selected at start, then every layer of the data file. The picker
// lists every layer of the manifest, loaded or not: a layer's grids are fetched
// the first time it is chosen.

import type { LayerManifest } from "../data/types";

/** Picker value of the plain Earth view. Not a layer id of the data file. */
export const EARTH_VIEW_ID = "earth";

export interface LayerChoice {
  id: string;
  label: string;
}

/** Anything that carries a layer's manifest: a loaded layer or a manifest entry alone. */
export interface WithManifest {
  manifest: LayerManifest;
}

/** The choices shown in the picker, Earth first. */
export function layerChoices(layers: readonly WithManifest[]): LayerChoice[] {
  return [
    { id: EARTH_VIEW_ID, label: "Earth (no layer)" },
    ...layers.map(({ manifest }) => ({
      id: manifest.id,
      label: `${manifest.title}${manifest.global ? "" : " (Amazon only)"}${manifest.sample ? " (sample data)" : ""}`,
    })),
  ];
}

/** The data layer to draw for a picker value; null for the Earth view or an unknown value. */
export function layerForChoice<T extends WithManifest>(layers: readonly T[], choiceId: string): T | null {
  if (choiceId === EARTH_VIEW_ID) return null;
  return layers.find((layer) => layer.manifest.id === choiceId) ?? null;
}
