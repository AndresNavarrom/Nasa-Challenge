// Layers drawn on the planet from a sharp greyscale image of dots instead of their
// grids: lightning, like NASA SVS 5011 (lightning-4k.png, from
// tools/fetch/lightning_dots.py). The image holds the real lightning dots of the
// SVS 5011 video, each as bright as lightning is frequent there (0 = no lightning);
// the shader colours it with the layer's ramp. The sound and the probe keep
// reading the grids.

import { LIGHTNING_IMAGE } from "./baseImage";
import { LAYER_RAMPS, type ColorRamp } from "./layerTexture";

export interface DotImageStyle {
  /** File in the data folder. */
  file: string;
  /** Colours (the layer's stops) and presence alpha on the image's 0..255 scale. */
  ramp: ColorRamp;
  /**
   * Soft glow around the dots: the image's mean over a coarser mipmap level
   * (`lodBias` levels up, about 2^lodBias pixels wide) added in the layer's middle
   * colour times `strength`. Dense clusters glow, lone dots barely.
   */
  glow: { strength: number; lodBias: number };
}

/**
 * Dimmest value of a whole lightning dot in the image (DOT_FLOOR in
 * tools/fetch/lightning_dots.py): dots are opaque from there; their soft rims,
 * lower, fade in from `from - fade`.
 */
export const LIGHTNING_DOT_FLOOR = 72;

/** Presence of the lightning image: opaque from 48 (every whole dot), nothing up to 8 (faint rims). */
export const LIGHTNING_IMAGE_PRESENCE = { from: 48, fade: 40 } as const;

/** Layer id -> sharp dot image; layers not listed are drawn from their grids. */
export const DOT_IMAGE_LAYERS: Readonly<Record<string, DotImageStyle>> = {
  lightning: {
    file: LIGHTNING_IMAGE,
    ramp: { ...LAYER_RAMPS.lightning!, presence: LIGHTNING_IMAGE_PRESENCE },
    glow: { strength: 0.35, lodBias: 3 },
  },
};

/** The dot image of a layer, or null when the layer is drawn from its grids. */
export function dotImageFor(layerId: string): DotImageStyle | null {
  return DOT_IMAGE_LAYERS[layerId] ?? null;
}

/** Glow colour (0..1 RGB): the ramp's colour halfway up, a warm yellow for lightning. */
export function glowColor(ramp: ColorRamp): [number, number, number] {
  const stops = ramp.stops && ramp.stops.length >= 2 ? ramp.stops : [ramp.low, ramp.high];
  const middle = stops[Math.floor((stops.length - 1) / 2)]!;
  return [middle[0] / 255, middle[1] / 255, middle[2] / 255];
}
