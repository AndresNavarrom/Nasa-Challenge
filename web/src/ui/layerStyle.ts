// How each layer choice looks and reads in the HUD: its contrast colour (the
// arcs, its button and the spectrum take it while it is picked), a short label
// for its button and one sentence that explains what its sound means.
//
// The colours are the tokens of index.css (`--color-forest`, `--color-smoke`,
// `--color-co2`, `--color-lightning`, `--color-landing-ink`), written out here
// because the spectrum is drawn on a canvas, which cannot read a class.

import { EARTH_VIEW_ID } from "./layerChoice";

export interface LayerStyle {
  color: string;
  /** Short name on the arc button. */
  short: string;
  /** What is heard and what a change in it means. */
  sound: string;
}

const EARTH_STYLE: LayerStyle = {
  color: "#e8edf5",
  short: "Earth",
  sound: "The plain Earth is silent. Pick a layer to hear its data.",
};

/** A layer the HUD does not know: it still gets a button, in the neutral colour. */
const UNKNOWN_SOUND = "Louder where the layer's value is higher.";

const LAYER_STYLES: Readonly<Record<string, LayerStyle>> = {
  [EARTH_VIEW_ID]: EARTH_STYLE,
  forest: {
    color: "#6fcf6b",
    short: "Forest",
    sound: "A clear tone: the taller the forest, the higher the note. Bare land is quiet.",
  },
  smoke: {
    color: "#f08a3c",
    short: "Smoke",
    sound: "A hazy tone: the thicker the smoke, the rougher and darker it sounds.",
  },
  co2: {
    color: "#7fb4ff",
    short: "CO2",
    sound: "A breath: the more CO2 in the air, the faster and heavier the breathing.",
  },
  lightning: {
    color: "#ffd166",
    short: "Lightning",
    sound: "Percussion: the more lightning, the faster and higher the strikes.",
  },
};

/** The style of a layer choice (a layer id or EARTH_VIEW_ID). */
export function layerStyle(choiceId: string, title?: string): LayerStyle {
  return (
    LAYER_STYLES[choiceId] ?? {
      color: EARTH_STYLE.color,
      short: title ?? choiceId,
      sound: UNKNOWN_SOUND,
    }
  );
}

/** Added to every layer's sentence on the planet view, where the whole visible side sounds. */
export const OVERVIEW_SOUND_NOTE = "On the planet: low notes near the poles, high at the equator, left and right as on screen.";
/** Added on a regional map, where one point sounds. */
export const MAP_SOUND_NOTE = "On the map: you hear the point you clicked.";
