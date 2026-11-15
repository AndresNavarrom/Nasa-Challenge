// Regions of the planet that can be highlighted and visited: every region is
// outlined on the planet, hovering one highlights it, and double-clicking it flies
// to it like the Amazon map.
//
// The world is divided into about 22 regions (UN subregions built from Natural
// Earth's countries by tools/fetch/world_regions.py into data/regions.json):
// South America, Central Africa, Southeast Asia, Northern Europe… They cover every
// continent. The Amazon comes first and wins over South America where they
// overlap: it is a hand-drawn search area narrowed to the forest inside it (the
// forest height grid, at least FOREST_PRESENCE_MIN, about 5 m, smoothed), so its
// outline follows the forest edge; it is visited with the data file's rectangle,
// so its detailed images are used. Every other region is visited with the
// rectangle stored with it.
//
// For the shader, the regions are drawn into a "region map": one byte per cell,
// 0 outside every region, `index + 1` inside region `index`, north row first.

import type { BoundingBox, Grid } from "../data/types";
import { normalizeLongitude } from "../lib/interpolate";

export type LonLatPoint = readonly [lon: number, lat: number];
export type Ring = readonly LonLatPoint[];

export interface Region {
  id: string;
  name: string;
  /** Closed rings (the last point joins the first), filled together with the even-odd rule, so holes work. */
  rings: readonly Ring[];
  /** Rectangle the map view frames; the rectangle around the rings when missing. */
  bbox?: BoundingBox;
  /** Keep only the forest inside the rings (see FOREST_PRESENCE_MIN). */
  shapeByForest?: boolean;
}

/** The Amazon region; it is visited with the data file's rectangle. */
export const AMAZON_REGION_ID = "amazon";

export const AMAZON_REGION: Region = {
  id: AMAZON_REGION_ID,
  name: "Amazon",
  shapeByForest: true,
  rings: [
    [
      [-77, 2], [-73, 4], [-67, 5], [-62, 6.5], [-58, 7.5], [-54, 6], [-51, 4], [-49, 0], [-48.5, -1],
      [-50, -5], [-52, -10], [-54, -14], [-57, -16], [-62, -17.5], [-65, -18],
      [-67, -15], [-70, -13], [-73, -11], [-75, -8], [-77, -5], [-79, -2],
    ],
  ],
};

/** The regions until the world regions load (or when they fail to): the Amazon alone. */
export const DEFAULT_REGIONS: readonly Region[] = [AMAZON_REGION];

/** The Amazon followed by the world regions, so the Amazon wins where they overlap. */
export function withAmazon(world: readonly Region[]): Region[] {
  return [AMAZON_REGION, ...world.filter((region) => region.id !== AMAZON_REGION_ID)];
}

/** Rectangle around rings. */
export function ringsBbox(rings: readonly Ring[]): BoundingBox {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      west = Math.min(west, lon);
      east = Math.max(east, lon);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }
  if (!(east > west) || !(north > south)) throw new Error("A region needs rings that enclose an area.");
  return { west, south, east, north };
}

/** Rectangle the view flies to for a region: the data file's rectangle for the Amazon, the region's own otherwise. */
export function focusBboxFor(region: Region, dataBbox: BoundingBox): BoundingBox {
  if (region.id === AMAZON_REGION_ID) return dataBbox;
  return region.bbox ?? ringsBbox(region.rings);
}

/** True when the point lies inside the region's rings (even-odd rule over all of them). */
export function isInsideRegion(lon: number, lat: number, region: Region): boolean {
  const x = normalizeLongitude(lon);
  let inside = false;
  for (const ring of region.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i]!;
      const [xj, yj] = ring[j]!;
      if (yi > lat !== yj > lat && x < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Index of the first region whose rings hold the point, or null. */
export function regionIndexAt(lon: number, lat: number, regions: readonly Region[]): number | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  const index = regions.findIndex((region) => isInsideRegion(lon, lat, region));
  return index >= 0 ? index : null;
}

export function regionById(id: string, regions: readonly Region[]): Region | null {
  return regions.find((region) => region.id === id) ?? null;
}

/** Decides whether a cell inside region `index` really belongs to it (used to keep only the Amazon's forest). */
export type CellFilter = (index: number, row: number, column: number) => boolean;

/**
 * The region map: `width` x `height` cells over the whole planet (equirectangular,
 * north row first), 0 outside every region and `index + 1` inside region `index`.
 * A cell belongs to the first region whose rings hold its centre (and that `keep`
 * accepts). Filled row by row: each edge is only visited for the rows it crosses,
 * so the whole world (tens of thousands of points) fills in a few tens of milliseconds.
 */
export function rasterizeRegions(width: number, height: number, regions: readonly Region[], keep?: CellFilter): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`The region map needs a positive whole size, got ${width} x ${height}.`);
  }
  if (regions.length > 255) throw new Error("The region map holds at most 255 regions.");
  const cells = new Uint8Array(width * height);
  const rowLat = (row: number) => 90 - ((row + 0.5) / height) * 180;
  regions.forEach((region, index) => {
    const crossings: number[][] = Array.from({ length: height }, () => []);
    for (const ring of region.rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        const [xi, yi] = ring[i]!;
        const [xj, yj] = ring[j]!;
        if (yi === yj) continue;
        const first = Math.max(0, Math.ceil(((90 - Math.max(yi, yj)) / 180) * height - 0.5));
        const last = Math.min(height - 1, Math.floor(((90 - Math.min(yi, yj)) / 180) * height - 0.5));
        for (let row = first; row <= last; row += 1) {
          const lat = rowLat(row);
          if (yi > lat !== yj > lat) crossings[row]!.push(((xj - xi) * (lat - yi)) / (yj - yi) + xi);
        }
      }
    }
    for (let row = 0; row < height; row += 1) {
      const xs = crossings[row]!;
      if (xs.length < 2) continue;
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        // Columns whose centre lies between the two crossings.
        const start = Math.max(0, Math.ceil(((xs[k]! + 180) / 360) * width - 0.5));
        const end = Math.min(width - 1, Math.floor(((xs[k + 1]! + 180) / 360) * width - 0.5));
        for (let column = start; column <= end; column += 1) {
          const cell = row * width + column;
          if (cells[cell] === 0 && (!keep || keep(index, row, column))) cells[cell] = index + 1;
        }
      }
    }
  });
  return cells;
}

/** Cells of the forest height grid counted as forest: 26 of 255 is about 5 m (the grid's 255 is 50 m). */
export const FOREST_PRESENCE_MIN = 26;
/** Smoothing of the forest before it is outlined, in forest-grid cells (0.25° each): drops specks and ragged edges. */
export const FOREST_SMOOTHING_CELLS = 2;

/** Region of every cell of the planet: 0 outside every region, `index + 1` inside region `index`, north row first. */
export interface RegionMap {
  width: number;
  height: number;
  cells: Uint8Array;
}

/** Index of the region under a point on a region map, or null. */
export function regionMapIndexAt(map: RegionMap, lon: number, lat: number): number | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  const u = (normalizeLongitude(lon) + 180) / 360;
  const v = (90 - lat) / 180;
  const column = Math.min(map.width - 1, Math.max(0, Math.floor(u * map.width)));
  const row = Math.min(map.height - 1, Math.max(0, Math.floor(v * map.height)));
  const value = map.cells[row * map.width + column] ?? 0;
  return value > 0 ? value - 1 : null;
}

/** Box blur of a field (row-major), wrapping east-west like the planet and clamped north-south. */
function boxBlur(field: Float32Array, width: number, height: number, radius: number): Float32Array {
  if (radius <= 0) return field;
  const span = 2 * radius + 1;
  const across = new Float32Array(field.length);
  for (let row = 0; row < height; row += 1) {
    const base = row * width;
    for (let column = 0; column < width; column += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) sum += field[base + ((column + k + width) % width)]!;
      across[base + column] = sum / span;
    }
  }
  const out = new Float32Array(field.length);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const r = Math.min(height - 1, Math.max(0, row + k));
        sum += across[r * width + column]!;
      }
      out[row * width + column] = sum / span;
    }
  }
  return out;
}

/** Bilinear value of a field at a fractional cell position (x wraps east-west, y is clamped). */
function bilinear(field: Float32Array, width: number, height: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.min(height - 1, Math.max(0, Math.floor(y)));
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = x - x0;
  const fy = Math.min(1, Math.max(0, y - y0));
  const c0 = ((x0 % width) + width) % width;
  const c1 = (c0 + 1) % width;
  const top = field[y0 * width + c0]! * (1 - fx) + field[y0 * width + c1]! * fx;
  const bottom = field[y1 * width + c0]! * (1 - fx) + field[y1 * width + c1]! * fx;
  return top * (1 - fy) + bottom * fy;
}

/**
 * The region map of the planet at `width` x `height` cells. Regions marked
 * `shapeByForest` keep only the cells where the smoothed forest presence (forest
 * height grid, whole planet, first instant) is at least one half, so their outline
 * follows the forest edge, and the rest of their area goes to the next region
 * that holds it. Without a usable grid, their rings are used as they are.
 */
export function buildRegionMap(width: number, height: number, forest: Grid | null, regions: readonly Region[]): RegionMap {
  const usable = forest !== null && forest.width > 0 && forest.height > 0 && forest.data.length >= forest.width * forest.height;
  if (!usable || !regions.some((region) => region.shapeByForest)) {
    return { width, height, cells: rasterizeRegions(width, height, regions) };
  }
  const presence = new Float32Array(forest.width * forest.height);
  for (let cell = 0; cell < presence.length; cell += 1) {
    presence[cell] = (forest.data[cell] ?? 0) >= FOREST_PRESENCE_MIN ? 1 : 0;
  }
  const smooth = boxBlur(presence, forest.width, forest.height, FOREST_SMOOTHING_CELLS);
  const keep: CellFilter = (index, row, column) => {
    if (!regions[index]?.shapeByForest) return true;
    // Centre of this cell in forest-grid cells (cell centres at .5).
    const x = ((column + 0.5) / width) * forest.width - 0.5;
    const y = ((row + 0.5) / height) * forest.height - 0.5;
    return bilinear(smooth, forest.width, forest.height, x, y) >= 0.5;
  };
  return { width, height, cells: rasterizeRegions(width, height, regions, keep) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseBbox(value: unknown): BoundingBox | undefined {
  if (!isRecord(value)) return undefined;
  const { west, south, east, north } = value;
  if ([west, south, east, north].every((side) => typeof side === "number" && Number.isFinite(side))) {
    const box = { west, south, east, north } as BoundingBox;
    if (box.east > box.west && box.north > box.south) return box;
  }
  return undefined;
}

function parseRing(value: unknown): Ring | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const ring: LonLatPoint[] = [];
  for (const point of value) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const [lon, lat] = point as unknown[];
    if (typeof lon !== "number" || typeof lat !== "number" || !Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
    ring.push([lon, lat]);
  }
  return ring;
}

/**
 * The world regions of a regions.json file. Throws an Error naming the problem when
 * the file is not a list of regions; a region with a broken ring is left out whole.
 */
export function parseWorldRegions(json: unknown): Region[] {
  if (!isRecord(json) || !Array.isArray(json.regions)) throw new Error('The regions file has no "regions" list.');
  const regions: Region[] = [];
  for (const entry of json.regions) {
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.name !== "string" || !Array.isArray(entry.rings)) continue;
    const rings = entry.rings.map(parseRing);
    if (rings.length === 0 || rings.some((ring) => ring === null)) continue;
    const bbox = parseBbox(entry.bbox);
    regions.push({ id: entry.id, name: entry.name, rings: rings as Ring[], ...(bbox ? { bbox } : {}) });
  }
  if (regions.length === 0) throw new Error("The regions file holds no usable region.");
  return regions;
}

/** Name of the world regions file inside the data folder. */
export const WORLD_REGIONS_FILE = "regions.json";

/** Loads the world regions (the Amazon first). Throws an Error with the address when the file cannot be read. */
export async function loadWorldRegions(
  baseUrl: string,
  fetcher: (input: string) => Promise<Response> = (input) => fetch(input),
): Promise<Region[]> {
  const url = `${baseUrl}${WORLD_REGIONS_FILE}`;
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`${url} could not be loaded (HTTP ${response.status}).`);
  return withAmazon(parseWorldRegions(await response.json()));
}
