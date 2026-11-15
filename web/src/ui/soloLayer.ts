// The layers never mix: only the layer picked in the panel's layer picker
// sounds, and every other voice is silenced (SoundEngine.setLayerEnabled). The
// plain Earth view draws no layer, so nothing sounds there. A silenced layer
// keeps its data; picking it again brings its voice back.

import { EARTH_VIEW_ID } from "./layerChoice";

/** Layer id -> whether its voice is on, for the picker value `activeChoiceId`. */
export function layerVoices(layerIds: readonly string[], activeChoiceId: string): Record<string, boolean> {
  return Object.fromEntries(layerIds.map((id) => [id, activeChoiceId !== EARTH_VIEW_ID && id === activeChoiceId]));
}
