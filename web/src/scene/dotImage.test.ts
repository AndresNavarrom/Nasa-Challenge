import { describe, expect, it } from "vitest";
import { LIGHTNING_IMAGE } from "./baseImage";
import { LIGHTNING_DOT_FLOOR, dotImageFor, glowColor } from "./dotImage";
import { LAYER_RAMPS, LIGHTNING_STOPS, rampAlpha, rampColor } from "./layerTexture";
import { shaderColorbar, shaderPresence } from "./relief";

describe("lightning drawn from the sharp dots image (like NASA SVS 5011)", () => {
  const style = dotImageFor("lightning")!;

  it("loads lightning-4k.png and colours it with the lightning stops, orange to almost white", () => {
    expect(style.file).toBe(LIGHTNING_IMAGE);
    expect(LIGHTNING_IMAGE).toBe("lightning-4k.png");
    expect(rampColor(style.ramp, 0)).toEqual([...LIGHTNING_STOPS[0]!]);
    expect(rampColor(style.ramp, 255)).toEqual([...LIGHTNING_STOPS[LIGHTNING_STOPS.length - 1]!]);
    // The shader's colour bar starts and ends on the same colours.
    const bar = shaderColorbar(style.ramp);
    expect([bar[0], bar[1], bar[2]].map((c) => Math.round(c! * 255))).toEqual([255, 120, 0]);
    expect([bar[30], bar[31], bar[32]].map((c) => Math.round(c! * 255))).toEqual([255, 252, 225]);
  });

  it("draws every whole dot opaque and leaves the empty ground and faint rims transparent", () => {
    expect(rampAlpha(style.ramp, 0)).toBe(0);
    expect(rampAlpha(style.ramp, 8)).toBe(0);
    expect(rampAlpha(style.ramp, 28)).toBe(128);
    expect(rampAlpha(style.ramp, LIGHTNING_DOT_FLOOR)).toBe(255);
    expect(rampAlpha(style.ramp, 255)).toBe(255);
    // The shader gets the same presence as the CPU ramp.
    const [start, fade] = shaderPresence(style.ramp);
    const shaderAlpha = (value: number) => Math.round(Math.min(1, Math.max(0, (value / 255 - start) / fade)) * 255);
    for (const value of [0, 8, 9, 18, 47, 48, 72, 200]) expect(shaderAlpha(value)).toBe(rampAlpha(style.ramp, value));
  });

  it("keeps the grid ramp of the layer (sound, probe and fallback) as it was", () => {
    const grid = LAYER_RAMPS.lightning!;
    expect(grid.presence).toEqual({ from: 60, fade: 42 });
    expect(style.ramp.stops).toBe(grid.stops);
    expect(style.ramp.opacity).toBe(1);
    expect(style.ramp.baseDim).toBe(grid.baseDim);
  });

  it("glows softly in the warm yellow halfway up the ramp", () => {
    expect(glowColor(style.ramp)).toEqual([1, 215 / 255, 60 / 255]);
    expect(style.glow.strength).toBeGreaterThan(0);
    expect(style.glow.strength).toBeLessThan(1);
    expect(style.glow.lodBias).toBeGreaterThanOrEqual(1);
    // A two-colour ramp glows in its first colour.
    expect(glowColor({ low: [10, 20, 30], high: [200, 200, 200], maxAlpha: 1 })).toEqual([10 / 255, 20 / 255, 30 / 255]);
  });

  it("leaves the other layers on their grids or their own images", () => {
    expect(dotImageFor("forest")).toBeNull();
    expect(dotImageFor("smoke")).toBeNull();
    expect(dotImageFor("co2")).toBeNull();
    expect(dotImageFor("unknown-layer")).toBeNull();
  });
});
