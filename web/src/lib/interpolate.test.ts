import { describe, expect, it } from "vitest";
import type { BoundingBox, Grid, LayerManifest, LoadedLayer } from "../data/types";
import { sampleFrame, sampleGrid, sampleLayerAt } from "./interpolate";

/** Builds a grid from rows of 0..255 values, one array of rows per frame. */
function gridOf(frames: number[][][]): Grid {
  const first = frames[0];
  if (!first || !first[0]) throw new Error("gridOf needs at least one row and one column");
  return {
    width: first[0].length,
    height: first.length,
    frames: frames.length,
    data: Uint8Array.from(frames.flat(2)),
  };
}

const AMAZON: BoundingBox = { west: -80, south: -20, east: -44, north: 8 };

function layerOf(region: Grid, isStatic: boolean, global: Grid | null = null, id: LayerManifest["id"] = "smoke"): LoadedLayer {
  const manifest: LayerManifest = {
    id,
    title: "Wildfire smoke",
    description: "Test layer",
    source: { title: "Test", url: "https://svs.gsfc.nasa.gov/5533" },
    static: isStatic,
    sample: true,
    dates: Array.from({ length: region.frames }, (_, index) => `Instant ${index + 1}`),
    global: null,
    region: { width: region.width, height: region.height, frames: region.frames, file: "r.bin", texture: "r.png" },
  };
  return { manifest, global, region };
}

describe("interpolate", () => {
  it("blends bilinearly between neighbouring cells", () => {
    // 2 x 2 grid: west column 0, east column 1 (255).
    const westToEast = gridOf([[[0, 255], [0, 255]]]);
    // Cell centres are at u = 0.25 and u = 0.75.
    expect(sampleFrame(westToEast, 0, 0.25, 0.5)).toBeCloseTo(0, 6);
    expect(sampleFrame(westToEast, 0, 0.75, 0.5)).toBeCloseTo(1, 6);
    expect(sampleFrame(westToEast, 0, 0.5, 0.5)).toBeCloseTo(0.5, 6);
    expect(sampleFrame(westToEast, 0, 0.375, 0.5)).toBeCloseTo(0.25, 6);

    // 3 x 3 grid with a single bright centre: halfway to a corner cell blends four cells.
    const peak = gridOf([[[0, 0, 0], [0, 255, 0], [0, 0, 0]]]);
    expect(sampleFrame(peak, 0, 0.5, 0.5)).toBeCloseTo(1, 6);
    expect(sampleFrame(peak, 0, 1 / 3, 1 / 3)).toBeCloseTo(0.25, 6);
  });

  it("blends linearly in time between two instants", () => {
    const quietThenLoud = gridOf([[[0, 0], [0, 0]], [[255, 255], [255, 255]]]);
    const at = (framePosition: number) =>
      sampleGrid(quietThenLoud, 0.5, 0.5, { framePosition, isStatic: false });

    expect(at(0)).toBeCloseTo(0, 6);
    expect(at(0.25)).toBeCloseTo(0.25, 6);
    expect(at(0.5)).toBeCloseTo(0.5, 6);
    expect(at(1)).toBeCloseTo(1, 6);
    // Positions past the last instant, or not a number, never read outside the data.
    expect(at(9)).toBeCloseTo(1, 6);
    expect(at(Number.NaN)).toBeCloseTo(0, 6);
  });

  it("keeps a static layer unchanged as time advances", () => {
    const twoFrames = gridOf([[[51, 51], [51, 51]], [[255, 255], [255, 255]]]);
    for (const framePosition of [0, 0.3, 0.7, 1]) {
      expect(sampleGrid(twoFrames, 0.5, 0.5, { framePosition, isStatic: true })).toBeCloseTo(0.2, 6);
    }
    const forest = layerOf(twoFrames, true);
    expect(sampleLayerAt(forest, AMAZON, -60, -5, 1)).toBeCloseTo(0.2, 6);
  });

  it("limits coordinates outside the grid to its edge", () => {
    const corners = gridOf([[[0, 102], [204, 255]]]);
    expect(sampleFrame(corners, 0, -5, -5)).toBeCloseTo(0, 6); // north-west corner
    expect(sampleFrame(corners, 0, 7, -5)).toBeCloseTo(0.4, 6); // north-east corner
    expect(sampleFrame(corners, 0, -5, 7)).toBeCloseTo(0.8, 6); // south-west corner
    expect(sampleFrame(corners, 0, 7, 7)).toBeCloseTo(1, 6); // south-east corner
    expect(sampleFrame(corners, 0, Number.NaN, 0)).toBeCloseTo(0, 6);

    // A whole-planet grid wraps at the date line instead of stopping at the edge.
    expect(sampleFrame(corners, 0, 0, 0, true)).toBeCloseTo(0.2, 6);

    // A region-only layer has no data outside the Amazon rectangle.
    const regionOnly = layerOf(corners, false);
    expect(sampleLayerAt(regionOnly, AMAZON, 20, 0, 0)).toBeNull();
    // With a whole-planet grid, the same place has a value.
    const withGlobal = layerOf(corners, false, corners);
    expect(sampleLayerAt(withGlobal, AMAZON, 20, 0, 0)).not.toBeNull();
  });

  it("reads the lightning layer like any other layer, inside and outside the Amazon (FR5.2)", () => {
    // Whole planet, 36 x 18 cells of 10 degrees: lightning only in the cell over
    // the Congo basin (20..30 E, 0..10 S: column 20, row 9).
    const globalRows = Array.from({ length: 18 }, () => Array.from({ length: 36 }, () => 0));
    globalRows[9]![20] = 200;
    // Amazon, 4 x 4 cells of 9 x 7 degrees: lightning only in the north-west cell (80..71 W, 1..8 N).
    const regionRows = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    regionRows[0]![0] = 200;
    const lightning = layerOf(gridOf([regionRows]), true, gridOf([globalRows]), "lightning");

    // Cell centres: no blending with the neighbours.
    expect(sampleLayerAt(lightning, AMAZON, -75.5, 4.5, 0)).toBeCloseTo(200 / 255, 6); // inside, with lightning
    expect(sampleLayerAt(lightning, AMAZON, -48.5, -16.5, 0)).toBe(0); // inside, without lightning
    expect(sampleLayerAt(lightning, AMAZON, 25, -5, 0)).toBeCloseTo(200 / 255, 6); // outside, with lightning
    expect(sampleLayerAt(lightning, AMAZON, 135, 45, 0)).toBe(0); // outside, without lightning
  });
});
