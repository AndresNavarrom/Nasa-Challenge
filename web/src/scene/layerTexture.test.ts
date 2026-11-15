import { describe, expect, it, vi } from "vitest";
import { DataTexture } from "three";
import type { Grid, LayerManifest, LoadedLayer } from "../data/types";
import {
  FIRST_INSTANT,
  GEDI_COLORBAR,
  LAYER_RAMPS,
  NEUTRAL_RAMP,
  disposeLayerTextures,
  gridToRgba,
  layerTextureFor,
  rampAlpha,
  rampColor,
  rampFor,
  type ColorRamp,
} from "./layerTexture";

const TEST_RAMP: ColorRamp = { low: [0, 0, 0], high: [255, 100, 50], maxAlpha: 1 };

describe("gridToRgba (FR1.2)", () => {
  it("turns the first instant of a 2 x 2 grid into the expected colours and transparencies", () => {
    // Two instants; the second one is all 255 so reading it by mistake shows up.
    const grid: Grid = { width: 2, height: 2, frames: 2, data: Uint8Array.from([0, 255, 51, 102, 255, 255, 255, 255]) };

    const pixels = gridToRgba(grid, FIRST_INSTANT, TEST_RAMP, "smoke");

    expect(Array.from(pixels)).toEqual([
      0, 0, 0, 0, // value 0: low colour, fully transparent
      255, 100, 50, 255, // value 255: high colour, opaque
      51, 20, 10, 51, // value 51 (20 %)
      102, 40, 20, 102, // value 102 (40 %)
    ]);

    // Ramps are chosen from the data's layer ids, with a neutral fallback (FR1.3).
    expect(rampFor("forest")).toBe(LAYER_RAMPS.forest);
    expect(rampFor("aerosol")).toBe(rampFor("smoke"));
    expect(rampFor("a-layer-added-later")).toBe(NEUTRAL_RAMP);
  });
});

describe("forest drawn like NASA SVS 4950", () => {
  const forest = LAYER_RAMPS.forest!;

  it("follows the GEDI colour bar from brown at 0 m to white at 50 m", () => {
    expect(rampColor(forest, 0)).toEqual(GEDI_COLORBAR[0]);
    expect(rampColor(forest, 255)).toEqual(GEDI_COLORBAR[10]);
    // 25 m is the middle stop of the eleven (index 5).
    expect(rampColor(forest, 127.5)).toEqual(GEDI_COLORBAR[5]);
    // Halfway between the first two stops.
    const half = rampColor(forest, 12.75);
    expect(half).toEqual([77, 70, 41]);
  });

  it("is opaque wherever there is forest and transparent where there is none", () => {
    expect(rampAlpha(forest, 0)).toBe(0);
    expect(rampAlpha(forest, 2)).toBe(0);
    expect(rampAlpha(forest, 4)).toBe(128);
    expect(rampAlpha(forest, 6)).toBe(255);
    expect(rampAlpha(forest, 200)).toBe(255);
    // Layers without `presence` keep alpha growing with the value.
    expect(rampAlpha(TEST_RAMP, 51)).toBe(51);
  });

  it("gives the forest height textures for the relief and the other layers none", () => {
    const manifest = (id: LayerManifest["id"]): LayerManifest => ({
      id,
      title: id,
      description: "Test layer",
      source: { title: "Test", url: "https://example.com" },
      static: true,
      sample: true,
      dates: ["2020-01-01"],
      global: { width: 4, height: 2, frames: 1, file: "global.bin", texture: "global.png" },
      region: { width: 2, height: 2, frames: 1, file: "region.bin", texture: "region.png" },
    });
    const global: Grid = { width: 4, height: 2, frames: 1, data: Uint8Array.from([0, 50, 100, 150, 200, 250, 10, 20]) };
    const region: Grid = { width: 2, height: 2, frames: 1, data: Uint8Array.from([9, 8, 7, 6]) };

    const withRelief = layerTextureFor({ manifest: manifest("forest"), global, region });
    expect(withRelief.heightGlobal?.image.data).toEqual(global.data);
    expect(withRelief.heightRegion?.image.data).toEqual(region.data);
    expect(withRelief.opacity).toBe(0.95);
    disposeLayerTextures(withRelief);

    const flat = layerTextureFor({ manifest: manifest("smoke"), global, region });
    expect(flat.heightGlobal).toBeNull();
    expect(flat.heightRegion).toBeNull();
    expect(flat.opacity).toBe(0.8);
    disposeLayerTextures(flat);
  });
});

describe("gridToRgba errors (FR1.3)", () => {
  it("fails with a message naming the layer when the grid has fewer bytes than declared", () => {
    const shortGrid: Grid = { width: 2, height: 2, frames: 2, data: Uint8Array.from([1, 2, 3, 4, 5]) };

    expect(() => gridToRgba(shortGrid, FIRST_INSTANT, TEST_RAMP, "co2")).toThrow(
      'Layer "co2": its grid has 5 bytes but 2 x 2 x 2 = 8 are declared.',
    );

    const grid: Grid = { width: 1, height: 1, frames: 1, data: Uint8Array.from([7]) };
    expect(() => gridToRgba(grid, 1, TEST_RAMP, "forest")).toThrow(/Layer "forest": instant 1 does not exist/);
  });

  it("disposes the whole-planet texture when the regional one cannot be built", () => {
    const manifest: LayerManifest = {
      id: "forest",
      title: "Forest",
      description: "Test layer",
      source: { title: "Test", url: "https://example.com" },
      static: true,
      sample: true,
      dates: ["2020-01-01"],
      global: { width: 1, height: 1, frames: 1, file: "global.bin", texture: "global.png" },
      region: { width: 2, height: 2, frames: 1, file: "region.bin", texture: "region.png" },
    };
    const global: Grid = { width: 1, height: 1, frames: 1, data: Uint8Array.from([1]) };
    // Four cells declared, one byte present: the regional texture throws.
    const region: Grid = { width: 2, height: 2, frames: 1, data: Uint8Array.from([1]) };
    const layer: LoadedLayer = { manifest, global, region };

    const dispose = vi.spyOn(DataTexture.prototype, "dispose");
    expect(() => layerTextureFor(layer)).toThrow(/Layer "forest"/);
    expect(dispose).toHaveBeenCalledTimes(1);
    dispose.mockRestore();
  });
});
