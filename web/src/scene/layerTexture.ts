// Layer textures drawn in the browser from the prepared grids (FR1.2, FR1.3, FR3, FR5.2).
// Works for any layer id in the data file: known ids get their own colour ramp,
// any other id gets a neutral ramp, so a new layer shows up without code changes.

import { ClampToEdgeWrapping, DataTexture, LinearFilter, RepeatWrapping, RGBAFormat, UnsignedByteType } from "three";
import type { Grid, LoadedLayer } from "../data/types";

export type Rgb = readonly [number, number, number];

/** Colour of a grid value: `low` at 0, `high` at 255; alpha grows with the value up to `maxAlpha` (0..1). */
export interface ColorRamp {
  low: Rgb;
  high: Rgb;
  maxAlpha: number;
}

export const NEUTRAL_RAMP: ColorRamp = { low: [90, 90, 100], high: [240, 240, 245], maxAlpha: 1 };

const SMOKE_RAMP: ColorRamp = { low: [170, 170, 170], high: [125, 72, 30], maxAlpha: 1 };

/** Ramps keyed by layer id; ids not listed here use NEUTRAL_RAMP. */
export const LAYER_RAMPS: Readonly<Record<string, ColorRamp>> = {
  forest: { low: [30, 90, 35], high: [140, 235, 95], maxAlpha: 1 },
  smoke: SMOKE_RAMP,
  aerosol: SMOKE_RAMP,
  co2: { low: [140, 90, 10], high: [255, 196, 50], maxAlpha: 1 },
  // Dark blue where lightning is rare to electric white where it strikes most often.
  lightning: { low: [20, 30, 110], high: [235, 245, 255], maxAlpha: 1 },
};

/** Index of the instant drawn while there is no timeline yet (plan rule: first instant). */
export const FIRST_INSTANT = 0;

export function rampFor(layerId: string): ColorRamp {
  return LAYER_RAMPS[layerId] ?? NEUTRAL_RAMP;
}

/**
 * RGBA pixels (row-major, north row first, like the grid) of one instant of a grid.
 * Throws an Error naming the layer when the grid holds fewer bytes than declared
 * or the instant does not exist.
 */
export function gridToRgba(grid: Grid, frame: number, ramp: ColorRamp, layerId: string): Uint8Array {
  const cells = grid.width * grid.height;
  const declared = cells * grid.frames;
  if (grid.data.length < declared) {
    throw new Error(
      `Layer "${layerId}": its grid has ${grid.data.length} bytes but ${grid.width} x ${grid.height} x ${grid.frames} = ${declared} are declared.`,
    );
  }
  if (!Number.isInteger(frame) || frame < 0 || frame >= grid.frames) {
    throw new Error(`Layer "${layerId}": instant ${frame} does not exist (the grid has ${grid.frames}).`);
  }
  const pixels = new Uint8Array(cells * 4);
  const offset = frame * cells;
  for (let cell = 0; cell < cells; cell += 1) {
    const value = grid.data[offset + cell] ?? 0;
    const t = value / 255;
    const out = cell * 4;
    pixels[out] = Math.round(ramp.low[0] + (ramp.high[0] - ramp.low[0]) * t);
    pixels[out + 1] = Math.round(ramp.low[1] + (ramp.high[1] - ramp.low[1]) * t);
    pixels[out + 2] = Math.round(ramp.low[2] + (ramp.high[2] - ramp.low[2]) * t);
    pixels[out + 3] = Math.round(value * ramp.maxAlpha);
  }
  return pixels;
}

function textureOf(grid: Grid, layerId: string, wrapAround: boolean): DataTexture {
  const pixels = gridToRgba(grid, FIRST_INSTANT, rampFor(layerId), layerId);
  const texture = new DataTexture(pixels, grid.width, grid.height, RGBAFormat, UnsignedByteType);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = wrapAround ? RepeatWrapping : ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export interface LayerTextures {
  /** Whole-planet texture; null for region-only layers. */
  global: DataTexture | null;
  /** Amazon texture, drawn inside `region.bbox` on the planet and on the map. */
  region: DataTexture;
}

/**
 * three.js textures of the first instant of a layer. Rows keep the grid order
 * (north first), so shaders sample them with `v = (north - lat) / (north - south)`.
 */
export function layerTextureFor(layer: LoadedLayer): LayerTextures {
  const id = layer.manifest.id;
  let global: DataTexture | null = null;
  try {
    global = layer.global ? textureOf(layer.global, id, true) : null;
    const region = textureOf(layer.region, id, false);
    return { global, region };
  } catch (cause) {
    // The whole planet texture may already exist when the region throws.
    global?.dispose();
    throw cause;
  }
}

export function disposeLayerTextures(textures: LayerTextures): void {
  textures.global?.dispose();
  textures.region.dispose();
}
