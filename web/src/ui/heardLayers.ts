// Which layers the person chose to hear, from the "Listen to" checkboxes of the
// panel. A layer that is not heard keeps its data and its drawing on the planet;
// only its voice is silenced (SoundEngine.setLayerEnabled).
//
// The choice is not stored: every visit starts with every layer heard, so the
// demo laptop never opens with a voice left off by the previous visitor.

/** Layer id -> heard. A missing id counts as heard. */
export type HeardLayers = Readonly<Record<string, boolean>>;

/** Every listed layer heard. */
export function allHeard(layerIds: readonly string[]): HeardLayers {
  return Object.fromEntries(layerIds.map((id) => [id, true]));
}

/** True when the layer is heard; ids never set count as heard. */
export function isHeard(heard: HeardLayers, layerId: string): boolean {
  return heard[layerId] !== false;
}

/** A copy of `heard` with one layer switched; the original is left unchanged. */
export function withHeard(heard: HeardLayers, layerId: string, on: boolean): HeardLayers {
  return { ...heard, [layerId]: on };
}

/** How many of the listed layers are heard. */
export function heardCount(heard: HeardLayers, layerIds: readonly string[]): number {
  return layerIds.filter((id) => isHeard(heard, id)).length;
}
