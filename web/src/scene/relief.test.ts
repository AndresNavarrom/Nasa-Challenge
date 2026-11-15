import { describe, expect, it } from "vitest";
import { GEDI_COLORBAR, LAYER_RAMPS, NEUTRAL_RAMP, rampAlpha } from "./layerTexture";
import { SHADER_STOPS, lodForSpacing, shadeStepDegrees, shaderColorbar, shaderPresence } from "./relief";

const forest = LAYER_RAMPS.forest!;

describe("relief shader colours (forest like NASA SVS 4950)", () => {
  it("hands the shader exactly the eleven GEDI colour bar stops", () => {
    const stops = shaderColorbar(forest);

    expect(SHADER_STOPS).toBe(GEDI_COLORBAR.length);
    expect(stops).toHaveLength(33);
    GEDI_COLORBAR.forEach((color, i) => {
      expect(stops[i * 3]).toBeCloseTo(color[0] / 255, 6);
      expect(stops[i * 3 + 1]).toBeCloseTo(color[1] / 255, 6);
      expect(stops[i * 3 + 2]).toBeCloseTo(color[2] / 255, 6);
    });
  });

  it("gives the same presence alpha as rampAlpha: none up to 2, opaque from 6", () => {
    const [start, fade] = shaderPresence(forest);
    const shaderAlpha = (value: number) => Math.round(Math.min(1, Math.max(0, (value / 255 - start) / fade)) * 255);

    for (const value of [0, 1, 2, 3, 4, 5, 6, 7, 100, 255]) {
      expect(shaderAlpha(value)).toBe(rampAlpha(forest, value));
    }
    // A ramp without presence keeps alpha growing with the value.
    expect(shaderPresence(NEUTRAL_RAMP)).toEqual([0, 1]);
  });
});

describe("relief levels of detail", () => {
  it("samples coarser mipmap levels as the spacing grows past one texel", () => {
    // 8k forest image (0.044 degree texels) under a 512-column mesh (0.7 degree per vertex): level 4.
    expect(lodForSpacing(360 / 512, 360 / 8192)).toBeCloseTo(4, 6);
    expect(lodForSpacing(0.02, 0.01)).toBeCloseTo(1, 6);
    // Finer than a texel, or an unknown size: the full-resolution level.
    expect(lodForSpacing(0.1, 0.25)).toBe(0);
    expect(lodForSpacing(0.1, 0)).toBe(0);
    expect(lodForSpacing(Number.NaN, 0.1)).toBe(0);
  });

  it("keeps the fixed shading step unless the texture is coarser", () => {
    expect(shadeStepDegrees(0.1, 360 / 8192)).toBe(0.1);
    expect(shadeStepDegrees(0.02, 0.01)).toBe(0.02);
    // Fallback grids: one cell of 0.25 or 0.1 degree.
    expect(shadeStepDegrees(0.1, 0.25)).toBe(0.25);
    expect(shadeStepDegrees(0.02, 0.1)).toBe(0.1);
  });
});
