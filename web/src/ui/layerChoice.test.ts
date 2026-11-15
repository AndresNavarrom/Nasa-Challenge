import { describe, expect, it } from "vitest";
import type { Grid, LayerManifest, LoadedLayer } from "../data/types";
import { EARTH_VIEW_ID, layerChoices, layerForChoice } from "./layerChoice";

function layer(id: LayerManifest["id"], title: string, global: boolean): LoadedLayer {
  const grid: Grid = { width: 1, height: 1, frames: 1, data: Uint8Array.from([0]) };
  const info = { width: 1, height: 1, frames: 1, file: "x.bin", texture: "x.png" };
  const manifest: LayerManifest = {
    id,
    title,
    description: "Test layer",
    source: { title: "Test", url: "https://example.com" },
    static: true,
    sample: false,
    dates: ["2020"],
    global: global ? info : null,
    region: info,
  };
  return { manifest, global: global ? grid : null, region: grid };
}

const layers = [layer("forest", "Forest height", true), layer("co2", "Atmospheric CO2", true)];

describe("layer picker with a plain Earth view", () => {
  it("offers Earth first, then every layer of the data file", () => {
    expect(layerChoices(layers)).toEqual([
      { id: EARTH_VIEW_ID, label: "Earth (no layer)" },
      { id: "forest", label: "Forest height" },
      { id: "co2", label: "Atmospheric CO2" },
    ]);
  });

  it("marks a layer that has only an Amazon grid", () => {
    const regional = [layer("smoke", "Wildfire smoke", false)];
    expect(layerChoices(regional)[1]).toEqual({ id: "smoke", label: "Wildfire smoke (Amazon only)" });
  });

  it("draws no layer for Earth and the matching layer otherwise", () => {
    expect(layerForChoice(layers, EARTH_VIEW_ID)).toBeNull();
    expect(layerForChoice(layers, "co2")).toBe(layers[1]);
    // A value that is neither Earth nor a layer draws nothing rather than failing.
    expect(layerForChoice(layers, "missing")).toBeNull();
  });
});
