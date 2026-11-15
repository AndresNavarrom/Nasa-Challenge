// Shapes of the prepared data shipped under web/public/data/.
// Written by tools/prep (Rust) and read by loadManifest.ts.

// Keep in step with LAYER_IDS in tools/prep/src/config.rs. `co2` stays accepted
// although the data file no longer lists it.
export const LAYER_IDS = ["forest", "smoke", "co2", "lightning"] as const;
export type LayerId = (typeof LAYER_IDS)[number];

/** One intensity grid file: `frames * height * width` bytes, values 0..255. */
export interface GridInfo {
  width: number;
  height: number;
  frames: number;
  /** Path of the binary file, relative to the data folder. */
  file: string;
  /** Path of a still image used to draw the layer, relative to the data folder. */
  texture: string;
}

export interface LayerSource {
  title: string;
  url: string;
}

/** Spacing of a layer's instants, from its ISO 8601 `cadence` (`PT1H`, `P1D`, `P1M`). */
export interface Cadence {
  unit: "hour" | "day" | "month";
  count: number;
}

export interface LayerManifest {
  id: LayerId;
  title: string;
  description: string;
  source: LayerSource;
  /** True when the layer has no time dimension (forest). */
  static: boolean;
  /** True when the values are generated sample data, not NASA frames. */
  sample: boolean;
  /** Date label of each instant; one entry per frame. */
  dates: string[];
  /**
   * Start of each instant in UTC, in milliseconds since 1970; one entry per frame,
   * in order. Absent for static layers and for sample data (then the instants are
   * evenly spaced).
   */
  times?: number[];
  /** Spacing of the instants; absent for static layers and sample data. */
  cadence?: Cadence;
  /** Whole-planet grid; null when the visualization has no usable global flat view. */
  global: GridInfo | null;
  /** Detailed Amazon grid. */
  region: GridInfo;
}

/** Latitude/longitude rectangle of the Amazon region, in degrees. */
export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Manifest {
  layers: LayerManifest[];
  region: { bbox: BoundingBox };
}

/** A grid with its bytes loaded in memory. */
export interface Grid {
  width: number;
  height: number;
  frames: number;
  /** Row-major, north row first, west column first; frame after frame. */
  data: Uint8Array;
}

export interface LoadedLayer {
  manifest: LayerManifest;
  global: Grid | null;
  region: Grid;
}

export interface JukeboxData {
  layers: LoadedLayer[];
  bbox: BoundingBox;
  /** Base URL of the data folder, ending with a slash. */
  baseUrl: string;
}
