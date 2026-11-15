import { describe, expect, it } from "vitest";
import { EARTH_VIEW_ID } from "./layerChoice";
import { layerVoices } from "./soloLayer";

const IDS = ["forest", "smoke", "co2", "lightning"] as const;

describe("only the picked layer sounds", () => {
  it("turns on the picked layer's voice and silences every other one", () => {
    expect(layerVoices(IDS, "smoke")).toEqual({ forest: false, smoke: true, co2: false, lightning: false });
  });

  it("follows the picker when another layer is picked", () => {
    const voices = layerVoices(IDS, "lightning");
    expect(voices.lightning).toBe(true);
    expect(voices.smoke).toBe(false);
  });

  it("silences every layer on the plain Earth view", () => {
    expect(Object.values(layerVoices(IDS, EARTH_VIEW_ID)).some(Boolean)).toBe(false);
  });

  it("silences every layer for a picker value that is not a layer", () => {
    expect(Object.values(layerVoices(IDS, "unknown")).some(Boolean)).toBe(false);
    expect(layerVoices([], "smoke")).toEqual({});
  });
});
