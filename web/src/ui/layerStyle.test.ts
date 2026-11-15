import { describe, expect, it } from "vitest";
import { LAYER_IDS } from "../data/types";
import { EARTH_VIEW_ID } from "./layerChoice";
import { layerStyle } from "./layerStyle";

/** The colours of index.css the layers may use: ink, forest, smoke, co2 and lightning. */
const PALETTE = ["#e8edf5", "#6fcf6b", "#f08a3c", "#7fb4ff", "#ffd166"];

describe("layer styles", () => {
  it("has a colour, a short name and a sound sentence for the Earth view and every layer", () => {
    for (const id of [EARTH_VIEW_ID, ...LAYER_IDS]) {
      const style = layerStyle(id);
      expect(style.color, id).toMatch(/^#[0-9a-f]{6}$/);
      expect(style.short.length, id).toBeGreaterThan(0);
      expect(style.short.length, id).toBeLessThanOrEqual(10);
      expect(style.sound.length, id).toBeGreaterThan(20);
      expect(style.sound.length, id).toBeLessThanOrEqual(110);
    }
  });

  it("uses the colours of the palette in index.css, not new ones", () => {
    for (const id of [EARTH_VIEW_ID, ...LAYER_IDS]) {
      expect(PALETTE, id).toContain(layerStyle(id).color);
    }
  });

  it("gives each layer its own colour", () => {
    const colors = LAYER_IDS.map((id) => layerStyle(id).color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("still styles a layer it does not know", () => {
    const style = layerStyle("rain", "Rainfall");
    expect(style.short).toBe("Rainfall");
    expect(style.color).toBe(layerStyle(EARTH_VIEW_ID).color);
    expect(style.sound.length).toBeGreaterThan(0);
  });
});
