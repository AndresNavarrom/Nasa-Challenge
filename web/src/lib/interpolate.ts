// Interpolation of the prepared grids (FR1.5): bilinear in space for every layer,
// linear in time only for layers that are not static.

import type { BoundingBox, Grid, LoadedLayer } from "../data/types";

export const WORLD_BBOX: BoundingBox = { west: -180, south: -90, east: 180, north: 90 };

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function cellValue(grid: Grid, frame: number, column: number, row: number): number {
  const index = (frame * grid.height + row) * grid.width + column;
  return (grid.data[index] ?? 0) / 255;
}

/**
 * Bilinear value (0..1) of one frame at grid coordinates `u`, `v`.
 *
 * `u` runs west to east and `v` north to south, both 0..1 across the whole grid;
 * cell centres sit at `(column + 0.5) / width`. Coordinates outside 0..1 are
 * limited to the edge. With `wrapX` the grid wraps around horizontally (a whole-planet
 * grid meets itself at the date line).
 */
export function sampleFrame(grid: Grid, frame: number, u: number, v: number, wrapX = false): number {
  const safeFrame = Math.min(grid.frames - 1, Math.max(0, Math.round(frame)));
  const x = clamp01(u) * grid.width - 0.5;
  const y = Math.min(grid.height - 1, Math.max(0, clamp01(v) * grid.height - 0.5));
  const boundedX = wrapX ? x : Math.min(grid.width - 1, Math.max(0, x));

  const x0 = Math.floor(boundedX);
  const y0 = Math.floor(y);
  const tx = boundedX - x0;
  const ty = y - y0;
  const column = (offset: number): number => {
    const raw = x0 + offset;
    if (wrapX) return ((raw % grid.width) + grid.width) % grid.width;
    return Math.min(grid.width - 1, Math.max(0, raw));
  };
  const y1 = Math.min(grid.height - 1, y0 + 1);

  const top = cellValue(grid, safeFrame, column(0), y0) * (1 - tx) + cellValue(grid, safeFrame, column(1), y0) * tx;
  const bottom = cellValue(grid, safeFrame, column(0), y1) * (1 - tx) + cellValue(grid, safeFrame, column(1), y1) * tx;
  return top * (1 - ty) + bottom * ty;
}

export interface SampleOptions {
  /** Fractional frame index, 0..frames-1 (see `framePosition` in timeline.ts). */
  framePosition: number;
  /** Static layers ignore time and always read their first frame. */
  isStatic: boolean;
  wrapX?: boolean;
}

/** Value (0..1) at `u`, `v`, blended linearly between the two instants around `framePosition`. */
export function sampleGrid(grid: Grid, u: number, v: number, options: SampleOptions): number {
  const wrapX = options.wrapX ?? false;
  if (options.isStatic || grid.frames <= 1) {
    return sampleFrame(grid, 0, u, v, wrapX);
  }
  const position = Math.min(grid.frames - 1, Math.max(0, Number.isNaN(options.framePosition) ? 0 : options.framePosition));
  const before = Math.floor(position);
  const after = Math.min(grid.frames - 1, before + 1);
  const mix = position - before;
  if (mix === 0 || after === before) {
    return sampleFrame(grid, before, u, v, wrapX);
  }
  return sampleFrame(grid, before, u, v, wrapX) * (1 - mix) + sampleFrame(grid, after, u, v, wrapX) * mix;
}

/** Grid coordinates of a longitude/latitude inside `bbox`, or null when the point is outside. */
export function lonLatToUV(lon: number, lat: number, bbox: BoundingBox): { u: number; v: number } | null {
  if (lon < bbox.west || lon > bbox.east || lat < bbox.south || lat > bbox.north) {
    return null;
  }
  return {
    u: (lon - bbox.west) / (bbox.east - bbox.west),
    v: (bbox.north - lat) / (bbox.north - bbox.south),
  };
}

/** Brings any longitude into -180..180. */
export function normalizeLongitude(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/**
 * Value (0..1) of a layer at a place and time, or null where the layer has no data.
 *
 * Inside the Amazon rectangle the detailed regional grid is used. Elsewhere the
 * whole-planet grid is used when the layer has one; region-only layers return null.
 */
export function sampleLayerAt(
  layer: LoadedLayer,
  bbox: BoundingBox,
  lon: number,
  lat: number,
  framePosition: number,
): number | null {
  const longitude = normalizeLongitude(lon);
  const latitude = Math.min(90, Math.max(-90, lat));
  const isStatic = layer.manifest.static;
  const inRegion = lonLatToUV(longitude, latitude, bbox);
  if (inRegion) {
    return sampleGrid(layer.region, inRegion.u, inRegion.v, { framePosition, isStatic });
  }
  if (!layer.global) {
    return null;
  }
  const onPlanet = lonLatToUV(longitude, latitude, WORLD_BBOX);
  if (!onPlanet) {
    return null;
  }
  return sampleGrid(layer.global, onPlanet.u, onPlanet.v, { framePosition, isStatic, wrapX: true });
}
