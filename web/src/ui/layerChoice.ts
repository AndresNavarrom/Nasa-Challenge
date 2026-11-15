// The layer picker's choices: "Earth" (the planet alone, no data layer drawn)
// first and selected at start, then every layer of the data file.

import type { LoadedLayer } from "../data/types";

/** Picker value of the plain Earth view. Not a layer id of the data file. */
export const EARTH_VIEW_ID = "earth";

export interface LayerChoice {
  id: string;
  label: string;
}

/** The choices shown in the picker, Earth first. */
export function layerChoices(layers: readonly LoadedLayer[]): LayerChoice[] {
  return [
    { id: EARTH_VIEW_ID, label: "Earth (no layer)" },
    ...layers.map(({ manifest, global }) => ({
      id: manifest.id,
      label: `${manifest.title}${global ? "" : " (Amazon only)"}${manifest.sample ? " (sample data)" : ""}`,
    })),
  ];
}

/** The data layer to draw for a picker value; null for the Earth view or an unknown value. */
export function layerForChoice(layers: readonly LoadedLayer[], choiceId: string): LoadedLayer | null {
  if (choiceId === EARTH_VIEW_ID) return null;
  return layers.find((layer) => layer.manifest.id === choiceId) ?? null;
}
