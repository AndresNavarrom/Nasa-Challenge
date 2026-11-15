// Layer textures drawn in the browser from the prepared grids (FR1.2, FR1.3, FR3, FR5.2).
// Works for any layer id in the data file: known ids get their own colour ramp,
// any other id gets a neutral ramp, so a new layer shows up without code changes.

import { ClampToEdgeWrapping, DataTexture, LinearFilter, RedFormat, RepeatWrapping, RGBAFormat, UnsignedByteType } from "three";
import type { Grid, LoadedLayer } from "../data/types";

export type Rgb = readonly [number, number, number];

/**
 * Colour of a grid value: `low` at 0, `high` at 255, or evenly spaced `stops`
 * when given. Alpha grows with the value up to `maxAlpha` (0..1), unless
 * `presence` is set: then the colour is opaque wherever the value is at least
 * `presence.from`, fading in over `presence.fade` steps below that.
 */
export interface ColorRamp {
  low: Rgb;
  high: Rgb;
  maxAlpha: number;
  stops?: readonly Rgb[];
  presence?: { from: number; fade: number };
  /** Opacity of the layer over the base image (default LAYER_OPACITY_DEFAULT). */
  opacity?: number;
  /** How much the base image is turned dark grey under this layer (0 = untouched, 1 = fully), for contrast. */
  baseDim?: number;
}

/** Lightning colours of NASA SVS 5011: orange, yellow, then pale yellow-white where it strikes most. */
export const LIGHTNING_STOPS: readonly Rgb[] = [
  [255, 120, 0],
  [255, 170, 20],
  [255, 215, 60],
  [255, 240, 150],
  [255, 252, 225],
];

export const LAYER_OPACITY_DEFAULT = 0.8;

/**
 * NASA's GEDI forest height colour bar (SVS 4950, GEDI_colorbar_0to50_01_print.jpg),
 * sampled every 5 m from 0 m (brown) through greens to 50 m (white). Same scale as
 * the forest grid (0 = 0 m, 255 = 50 m or more).
 */
export const GEDI_COLORBAR: readonly Rgb[] = [
  [77, 61, 38],
  [77, 78, 44],
  [78, 100, 52],
  [89, 117, 58],
  [106, 132, 60],
  [127, 146, 64],
  [148, 162, 75],
  [172, 179, 98],
  [203, 202, 142],
  [233, 224, 192],
  [253, 239, 229],
];

/** Layers drawn with shaded relief and raised height on the planet, like SVS 4950. */
export const RELIEF_LAYERS: ReadonlySet<string> = new Set(["forest"]);

export const NEUTRAL_RAMP: ColorRamp = { low: [90, 90, 100], high: [240, 240, 245], maxAlpha: 1 };

const SMOKE_RAMP: ColorRamp = { low: [170, 170, 170], high: [125, 72, 30], maxAlpha: 1 };

/** Ramps keyed by layer id; ids not listed here use NEUTRAL_RAMP. */
export const LAYER_RAMPS: Readonly<Record<string, ColorRamp>> = {
  // GEDI colour bar, opaque wherever there is forest (about 1 m or more), like SVS 4950.
  forest: { low: [77, 61, 38], high: [253, 239, 229], maxAlpha: 1, stops: GEDI_COLORBAR, presence: { from: 6, fade: 4 }, opacity: 0.95 },
  smoke: SMOKE_RAMP,
  aerosol: SMOKE_RAMP,
  co2: { low: [140, 90, 10], high: [255, 196, 50], maxAlpha: 1 },
  // Like NASA SVS 5011: glowing orange and yellow flashes over a dimmed grey Earth.
  // Rare lightning stays transparent (half of the cells with any lightning are below
  // 14 of 255), so only the active regions show; the busiest turn almost white.
  lightning: {
    low: [255, 120, 0],
    high: [255, 252, 225],
    maxAlpha: 1,
    stops: LIGHTNING_STOPS,
    presence: { from: 60, fade: 42 },
    opacity: 1,
    baseDim: 0.9,
  },
};

/** Index of the instant drawn while there is no timeline yet (plan rule: first instant). */
export const FIRST_INSTANT = 0;

export function rampFor(layerId: string): ColorRamp {
  return LAYER_RAMPS[layerId] ?? NEUTRAL_RAMP;
}

/** Colour of a grid value (0..255) on a ramp, interpolating between its stops when it has them. */
export function rampColor(ramp: ColorRamp, value: number): Rgb {
  const t = Math.min(1, Math.max(0, value / 255));
  const stops = ramp.stops && ramp.stops.length >= 2 ? ramp.stops : [ramp.low, ramp.high];
  const position = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(position));
  const f = position - index;
  const a = stops[index]!;
  const b = stops[index + 1]!;
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

/** Alpha (0..255) of a grid value on a ramp. */
export function rampAlpha(ramp: ColorRamp, value: number): number {
  if (ramp.presence) {
    const { from, fade } = ramp.presence;
    if (value >= from) return 255;
    const start = from - fade;
    if (value <= start) return 0;
    return Math.round(((value - start) / fade) * 255);
  }
  return Math.round(value * ramp.maxAlpha);
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
    const [r, g, b] = rampColor(ramp, value);
    const out = cell * 4;
    pixels[out] = r;
    pixels[out + 1] = g;
    pixels[out + 2] = b;
    pixels[out + 3] = rampAlpha(ramp, value);
  }
  return pixels;
}

/** Height texture of one instant (one byte per cell, north row first), for relief and raised height. */
function heightTextureOf(grid: Grid, layerId: string, wrapAround: boolean): DataTexture {
  const cells = grid.width * grid.height;
  if (grid.data.length < cells * (FIRST_INSTANT + 1)) {
    throw new Error(`Layer "${layerId}": its grid is too short for a height texture.`);
  }
  const heights = grid.data.slice(FIRST_INSTANT * cells, (FIRST_INSTANT + 1) * cells);
  const texture = new DataTexture(heights, grid.width, grid.height, RedFormat, UnsignedByteType);
  texture.unpackAlignment = 1;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = wrapAround ? RepeatWrapping : ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
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
  /** Heights for relief layers (RELIEF_LAYERS); null otherwise. */
  heightGlobal: DataTexture | null;
  heightRegion: DataTexture | null;
  /** Opacity of the layer over the base image. */
  opacity: number;
  /** How much the base image is dimmed to grey under this layer (0..1). */
  baseDim: number;
}

/**
 * three.js textures of the first instant of a layer. Rows keep the grid order
 * (north first), so shaders sample them with `v = (north - lat) / (north - south)`.
 */
export function layerTextureFor(layer: LoadedLayer): LayerTextures {
  const id = layer.manifest.id;
  const created: DataTexture[] = [];
  const keep = (texture: DataTexture): DataTexture => {
    created.push(texture);
    return texture;
  };
  try {
    const global = layer.global ? keep(textureOf(layer.global, id, true)) : null;
    const region = keep(textureOf(layer.region, id, false));
    const relief = RELIEF_LAYERS.has(id);
    const heightGlobal = relief && layer.global ? keep(heightTextureOf(layer.global, id, true)) : null;
    const heightRegion = relief ? keep(heightTextureOf(layer.region, id, false)) : null;
    const ramp = rampFor(id);
    return {
      global,
      region,
      heightGlobal,
      heightRegion,
      opacity: ramp.opacity ?? LAYER_OPACITY_DEFAULT,
      baseDim: ramp.baseDim ?? 0,
    };
  } catch (cause) {
    // Some textures may already exist when a later one throws.
    for (const texture of created) texture.dispose();
    throw cause;
  }
}

export function disposeLayerTextures(textures: LayerTextures): void {
  textures.global?.dispose();
  textures.region.dispose();
  textures.heightGlobal?.dispose();
  textures.heightRegion?.dispose();
}
